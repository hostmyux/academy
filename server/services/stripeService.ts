import Stripe from "stripe";
import { storage } from "../storage";
import type { User, InsertPayment } from "@shared/schema";

// Use mock key for development if not provided
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_mock_key_for_development';

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2024-06-20",
});

export class StripeService {
  async createCustomer(user: User): Promise<Stripe.Customer> {
    const customer = await stripe.customers.create({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      metadata: {
        userId: user.id,
        tenantId: user.tenantId,
        subAccountId: user.subAccountId || '',
      },
    });

    // Update user with Stripe customer ID
    await storage.updateUserStripeInfo(user.id, customer.id);

    return customer;
  }

  async createPaymentIntent(
    amount: number,
    currency: string = "USD",
    customerId: string,
    metadata: Record<string, string> = {}
  ): Promise<Stripe.PaymentIntent> {
    return await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      customer: customerId,
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });
  }

  async createSubscription(
    customerId: string,
    priceId: string,
    metadata: Record<string, string> = {}
  ): Promise<Stripe.Subscription> {
    return await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      metadata,
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });
  }

  async handleWebhook(
    payload: string,
    signature: string,
    endpointSecret: string
  ): Promise<void> {
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      throw err;
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;
        
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
        break;
        
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;
        
      case 'customer.subscription.deleted':
        await this.handleSubscriptionCancellation(event.data.object as Stripe.Subscription);
        break;
        
      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSuccess(event.data.object as Stripe.Invoice);
        break;
        
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    try {
      const metadata = paymentIntent.metadata;
      const tenantId = metadata.tenantId;
      const leadId = metadata.leadId;
      const applicationId = metadata.applicationId;

      if (!tenantId) {
        console.error('No tenantId in payment intent metadata');
        return;
      }

      // Create payment record
      const paymentData: InsertPayment = {
        tenantId,
        subAccountId: metadata.subAccountId || null,
        leadId: leadId || null,
        applicationId: applicationId || null,
        stripePaymentIntentId: paymentIntent.id,
        amount: (paymentIntent.amount / 100).toString(),
        currency: paymentIntent.currency.toUpperCase(),
        status: "completed",
        description: `Payment for ${paymentIntent.description || 'consulting services'}`,
        metadata: {
          stripePaymentIntentId: paymentIntent.id,
          paymentMethod: paymentIntent.payment_method,
        },
      };

      await storage.createPayment(paymentData);

      // Create activity record
      if (leadId) {
        await storage.createActivity({
          tenantId,
          subAccountId: metadata.subAccountId || null,
          leadId,
          type: "payment_received",
          description: `Payment of ${paymentData.currency} ${paymentData.amount} received`,
          metadata: { paymentIntentId: paymentIntent.id },
        });
      }

      console.log(`Payment processed successfully: ${paymentIntent.id}`);
    } catch (error) {
      console.error('Error handling payment success:', error);
    }
  }

  private async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    try {
      const metadata = paymentIntent.metadata;
      const tenantId = metadata.tenantId;

      if (!tenantId) {
        console.error('No tenantId in payment intent metadata');
        return;
      }

      // Update payment record if it exists
      const existingPayments = await storage.getPaymentsByTenant(tenantId);
      const existingPayment = existingPayments.find(
        p => p.stripePaymentIntentId === paymentIntent.id
      );

      if (existingPayment) {
        await storage.updatePayment(existingPayment.id, {
          status: "failed",
          metadata: {
            ...existingPayment.metadata,
            failureReason: paymentIntent.last_payment_error?.message || 'Unknown error',
          },
        });
      }

      console.log(`Payment failed: ${paymentIntent.id}`);
    } catch (error) {
      console.error('Error handling payment failure:', error);
    }
  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    try {
      const customerId = subscription.customer as string;
      const customer = await stripe.customers.retrieve(customerId);
      
      if (customer.deleted) {
        console.error('Customer was deleted');
        return;
      }

      const userId = customer.metadata?.userId;
      if (!userId) {
        console.error('No userId in customer metadata');
        return;
      }

      // Update user's subscription ID
      await storage.updateUserStripeInfo(userId, customerId, subscription.id);

      console.log(`Subscription updated: ${subscription.id} for user: ${userId}`);
    } catch (error) {
      console.error('Error handling subscription update:', error);
    }
  }

  private async handleSubscriptionCancellation(subscription: Stripe.Subscription): Promise<void> {
    try {
      const customerId = subscription.customer as string;
      const customer = await stripe.customers.retrieve(customerId);
      
      if (customer.deleted) {
        console.error('Customer was deleted');
        return;
      }

      const userId = customer.metadata?.userId;
      if (!userId) {
        console.error('No userId in customer metadata');
        return;
      }

      // Clear user's subscription ID
      await storage.updateUserStripeInfo(userId, customerId, undefined);

      console.log(`Subscription cancelled: ${subscription.id} for user: ${userId}`);
    } catch (error) {
      console.error('Error handling subscription cancellation:', error);
    }
  }

  private async handleInvoicePaymentSuccess(invoice: Stripe.Invoice): Promise<void> {
    try {
      const customerId = invoice.customer as string;
      const customer = await stripe.customers.retrieve(customerId);
      
      if (customer.deleted) {
        console.error('Customer was deleted');
        return;
      }

      const userId = customer.metadata?.userId;
      const tenantId = customer.metadata?.tenantId;
      
      if (!userId || !tenantId) {
        console.error('Missing userId or tenantId in customer metadata');
        return;
      }

      // Create payment record for subscription payment
      const paymentData: InsertPayment = {
        tenantId,
        subAccountId: customer.metadata?.subAccountId || null,
        leadId: null,
        applicationId: null,
        stripePaymentIntentId: invoice.payment_intent as string,
        amount: (invoice.amount_paid / 100).toString(),
        currency: invoice.currency.toUpperCase(),
        status: "completed",
        description: `Subscription payment - ${invoice.description || 'Monthly subscription'}`,
        metadata: {
          invoiceId: invoice.id,
          subscriptionId: invoice.subscription as string,
        },
      };

      await storage.createPayment(paymentData);

      console.log(`Subscription payment processed: ${invoice.id}`);
    } catch (error) {
      console.error('Error handling invoice payment success:', error);
    }
  }

  async getCustomerPortalUrl(customerId: string, returnUrl: string): Promise<string> {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return session.url;
  }

  async getPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    return paymentMethods.data;
  }

  async updateSubscription(
    subscriptionId: string,
    priceId: string
  ): Promise<Stripe.Subscription> {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    return await stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        price: priceId,
      }],
    });
  }

  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await stripe.subscriptions.cancel(subscriptionId);
  }

  async getUsageStats(tenantId: string): Promise<{
    totalRevenue: number;
    monthlyRevenue: number;
    activeSubscriptions: number;
    totalTransactions: number;
  }> {
    const payments = await storage.getPaymentsByTenant(tenantId);
    const completedPayments = payments.filter(p => p.status === 'completed');
    
    const totalRevenue = completedPayments.reduce(
      (sum, payment) => sum + parseFloat(payment.amount),
      0
    );

    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const monthlyPayments = completedPayments.filter(
      p => p.createdAt && p.createdAt >= currentMonth
    );
    
    const monthlyRevenue = monthlyPayments.reduce(
      (sum, payment) => sum + parseFloat(payment.amount),
      0
    );

    return {
      totalRevenue,
      monthlyRevenue,
      activeSubscriptions: 0, // Would need to track this separately
      totalTransactions: completedPayments.length,
    };
  }
}

export const stripeService = new StripeService();

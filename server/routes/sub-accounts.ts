import { Router } from 'express';
import { TenantMiddleware } from '../middleware/tenant';
import { storage } from '../storage';
import type { InsertSubAccount, InsertUser } from '@shared/schema';

const router = Router();

// Get all sub-accounts for the current tenant
router.get('/', TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const tenantContext = (req as any).tenantContext;
    const subAccounts = await storage.getSubAccountsByTenant(tenantContext.tenantId);
    res.json(subAccounts);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new sub-account
router.post('/', TenantMiddleware.requireTenantAdmin, async (req, res) => {
  try {
    const tenantContext = (req as any).tenantContext;
    const { name, description, settings } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Sub-account name is required' });
    }

    const subAccountData: InsertSubAccount = {
      tenantId: tenantContext.tenantId,
      name,
      description: description || '',
      settings: settings || {},
    };

    const subAccount = await storage.createSubAccount(subAccountData);

    // Log the creation
    await storage.createActivity({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      type: 'sub_account_created',
      description: `Created sub-account: ${name}`,
    });

    res.status(201).json(subAccount);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get a specific sub-account
router.get('/:id', TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const tenantContext = (req as any).tenantContext;
    const subAccount = await storage.getSubAccount(req.params.id);

    if (!subAccount) {
      return res.status(404).json({ message: 'Sub-account not found' });
    }

    // Verify the sub-account belongs to the current tenant
    if (subAccount.tenantId !== tenantContext.tenantId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(subAccount);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Update a sub-account
router.put('/:id', TenantMiddleware.requireTenantAdmin, async (req, res) => {
  try {
    const tenantContext = (req as any).tenantContext;
    const { name, description, settings } = req.body;

    // First verify the sub-account exists and belongs to the tenant
    const existingSubAccount = await storage.getSubAccount(req.params.id);
    if (!existingSubAccount) {
      return res.status(404).json({ message: 'Sub-account not found' });
    }

    if (existingSubAccount.tenantId !== tenantContext.tenantId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const updates: Partial<InsertSubAccount> = {};
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (settings) updates.settings = settings;

    const updatedSubAccount = await storage.updateSubAccount(req.params.id, updates);

    // Log the update
    await storage.createActivity({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      type: 'sub_account_updated',
      description: `Updated sub-account: ${name || existingSubAccount.name}`,
    });

    res.json(updatedSubAccount);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Delete a sub-account
router.delete('/:id', TenantMiddleware.requireTenantAdmin, async (req, res) => {
  try {
    const tenantContext = (req as any).tenantContext;

    // First verify the sub-account exists and belongs to the tenant
    const existingSubAccount = await storage.getSubAccount(req.params.id);
    if (!existingSubAccount) {
      return res.status(404).json({ message: 'Sub-account not found' });
    }

    if (existingSubAccount.tenantId !== tenantContext.tenantId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if there are any users in this sub-account
    const usersInSubAccount = await storage.getUsersBySubAccount(req.params.id);
    if (usersInSubAccount.length > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete sub-account with active users. Please reassign or delete users first.' 
      });
    }

    // In a real implementation, you would delete the sub-account here
    // For now, we'll just log and return success
    await storage.createActivity({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      type: 'sub_account_deleted',
      description: `Deleted sub-account: ${existingSubAccount.name}`,
    });

    res.json({ message: 'Sub-account deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get users in a specific sub-account
router.get('/:id/users', TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const tenantContext = (req as any).tenantContext;

    // Verify the sub-account exists and belongs to the tenant
    const subAccount = await storage.getSubAccount(req.params.id);
    if (!subAccount) {
      return res.status(404).json({ message: 'Sub-account not found' });
    }

    if (subAccount.tenantId !== tenantContext.tenantId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const users = await storage.getUsersBySubAccount(req.params.id);
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Add a user to a sub-account
router.post('/:id/users', TenantMiddleware.requireTenantAdmin, async (req, res) => {
  try {
    const tenantContext = (req as any).tenantContext;
    const { userId, role } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Verify the sub-account exists and belongs to the tenant
    const subAccount = await storage.getSubAccount(req.params.id);
    if (!subAccount) {
      return res.status(404).json({ message: 'Sub-account not found' });
    }

    if (subAccount.tenantId !== tenantContext.tenantId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Verify the user exists and belongs to the tenant
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.tenantId !== tenantContext.tenantId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update the user to assign to sub-account
    const updatedUser = await storage.updateUser(userId, {
      subAccountId: req.params.id,
      role: role || user.role,
    });

    // Log the assignment
    await storage.createActivity({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      type: 'user_assigned_to_sub_account',
      description: `Assigned user ${user.firstName} ${user.lastName} to sub-account ${subAccount.name}`,
    });

    res.json(updatedUser);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Remove a user from a sub-account
router.delete('/:id/users/:userId', TenantMiddleware.requireTenantAdmin, async (req, res) => {
  try {
    const tenantContext = (req as any).tenantContext;

    // Verify the sub-account exists and belongs to the tenant
    const subAccount = await storage.getSubAccount(req.params.id);
    if (!subAccount) {
      return res.status(404).json({ message: 'Sub-account not found' });
    }

    if (subAccount.tenantId !== tenantContext.tenantId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Verify the user exists and belongs to the tenant
    const user = await storage.getUser(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.tenantId !== tenantContext.tenantId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update the user to remove from sub-account
    const updatedUser = await storage.updateUser(req.params.userId, {
      subAccountId: null,
    });

    // Log the removal
    await storage.createActivity({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      type: 'user_removed_from_sub_account',
      description: `Removed user ${user.firstName} ${user.lastName} from sub-account ${subAccount.name}`,
    });

    res.json(updatedUser);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
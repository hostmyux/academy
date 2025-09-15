import OpenAI from "openai";
import type { Lead, Program, University } from "@shared/schema";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || "sk-mock-key-for-development" 
});

export class AIService {
  async scoreLead(lead: Lead): Promise<number> {
    try {
      const prompt = `Analyze this student lead and provide a score from 0-100 based on their likelihood to convert and successfully complete an application.

Lead Information:
- Name: ${lead.firstName} ${lead.lastName}
- Email: ${lead.email}
- Program Interest: ${lead.programInterest || 'Not specified'}
- Target Country: ${lead.targetCountry || 'Not specified'}
- Budget: ${lead.budget || 'Not specified'}
- Source: ${lead.source || 'Unknown'}
- Notes: ${lead.notes || 'None'}

Consider factors like:
- Clarity of goals and program interest
- Budget alignment with typical program costs
- Communication quality and engagement
- Completeness of information provided

Respond with JSON in this format: { "score": number, "reasoning": "explanation" }`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are an AI assistant specialized in lead scoring for educational consulting. Provide accurate, helpful scoring based on the lead's information."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content || '{"score": 50}');
      return Math.max(0, Math.min(100, Math.round(result.score)));
    } catch (error) {
      console.error('Error scoring lead:', error);
      return 50; // Default score on error
    }
  }

  async recommendPrograms(lead: Lead, programs: Program[], universities: University[]): Promise<{
    recommendations: Array<{
      programId: string;
      score: number;
      reasoning: string;
    }>;
  }> {
    try {
      const universityMap = new Map(universities.map(u => [u.id, u]));
      
      const programsWithUniversities = programs.map(program => {
        const university = universityMap.get(program.universityId);
        return {
          ...program,
          university: university ? {
            name: university.name,
            country: university.country,
            ranking: university.ranking
          } : null
        };
      });

      const prompt = `Based on this student's profile, recommend the top 5 most suitable programs from the provided list.

Student Profile:
- Name: ${lead.firstName} ${lead.lastName}
- Program Interest: ${lead.programInterest || 'Not specified'}
- Target Country: ${lead.targetCountry || 'Not specified'}
- Budget: ${lead.budget || 'Not specified'}
- Notes: ${lead.notes || 'None'}

Available Programs:
${programsWithUniversities.slice(0, 20).map(p => 
  `- ${p.name} at ${p.university?.name || 'Unknown'} (${p.university?.country || 'Unknown'})
    Degree: ${p.degreeType}, Field: ${p.field || 'General'}
    Tuition: ${p.tuitionFee || 'Not specified'} ${p.currency || ''}
    Duration: ${p.duration || 'Not specified'}`
).join('\n')}

Consider factors like:
- Program alignment with student's interests
- Country preference match
- Budget compatibility
- University reputation and ranking
- Program requirements fit

Respond with JSON in this format: 
{
  "recommendations": [
    {
      "programId": "program_id",
      "score": number_0_to_100,
      "reasoning": "explanation"
    }
  ]
}

Limit to top 5 recommendations.`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are an AI assistant specialized in educational program recommendations. Provide accurate, helpful recommendations based on student profiles and program information."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
      });

      const result = JSON.parse(response.choices[0].message.content || '{"recommendations": []}');
      return result;
    } catch (error) {
      console.error('Error recommending programs:', error);
      return { recommendations: [] };
    }
  }

  async analyzeSentiment(text: string): Promise<{
    sentiment: 'positive' | 'neutral' | 'negative';
    confidence: number;
    keywords: string[];
  }> {
    try {
      const prompt = `Analyze the sentiment of this text and extract key emotional indicators.

Text: "${text}"

Provide a sentiment analysis including:
- Overall sentiment (positive, neutral, or negative)
- Confidence level (0-1)
- Key emotional keywords or phrases

Respond with JSON in this format:
{
  "sentiment": "positive|neutral|negative",
  "confidence": number_0_to_1,
  "keywords": ["keyword1", "keyword2"]
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are an AI assistant specialized in sentiment analysis for educational consulting communications."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const result = JSON.parse(response.choices[0].message.content || '{"sentiment": "neutral", "confidence": 0.5, "keywords": []}');
      return result;
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      return { sentiment: 'neutral', confidence: 0.5, keywords: [] };
    }
  }

  async generateEmailTemplate(type: 'welcome' | 'follow_up' | 'application_reminder' | 'acceptance_congratulations', context: {
    studentName: string;
    programName?: string;
    universityName?: string;
    deadline?: string;
    agentName?: string;
  }): Promise<{
    subject: string;
    body: string;
  }> {
    try {
      const prompt = `Generate a professional email template for ${type} communication in the context of educational consulting.

Context:
- Student Name: ${context.studentName}
- Program: ${context.programName || 'Not specified'}
- University: ${context.universityName || 'Not specified'}
- Deadline: ${context.deadline || 'Not specified'}
- Agent Name: ${context.agentName || 'Your consultant'}

The email should be:
- Professional and warm
- Personalized with the provided context
- Clear and actionable
- Appropriate for the communication type

Respond with JSON in this format:
{
  "subject": "email subject line",
  "body": "email body content"
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are an AI assistant specialized in writing professional educational consulting emails. Create templates that are warm, helpful, and action-oriented."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.6,
      });

      const result = JSON.parse(response.choices[0].message.content || '{"subject": "Update from your consultant", "body": "Thank you for your interest."}');
      return result;
    } catch (error) {
      console.error('Error generating email template:', error);
      return {
        subject: 'Update from your consultant',
        body: 'Thank you for your interest in our educational consulting services.'
      };
    }
  }

  async prioritizeTasks(tasks: Array<{
    id: string;
    title: string;
    description?: string;
    dueDate?: string;
    leadId?: string;
    applicationId?: string;
  }>): Promise<Array<{
    taskId: string;
    priority: number;
    reasoning: string;
  }>> {
    try {
      const prompt = `Prioritize these tasks for an educational consultant based on urgency, importance, and impact.

Tasks:
${tasks.map(task => 
  `- ${task.title} (ID: ${task.id})
    Description: ${task.description || 'No description'}
    Due Date: ${task.dueDate || 'No deadline'}
    Type: ${task.leadId ? 'Lead-related' : task.applicationId ? 'Application-related' : 'General'}`
).join('\n')}

Consider factors like:
- Deadlines and time sensitivity
- Impact on student success
- Revenue potential
- Difficulty/effort required
- Dependencies on other tasks

Respond with JSON in this format:
{
  "prioritizedTasks": [
    {
      "taskId": "task_id",
      "priority": number_1_to_10,
      "reasoning": "explanation"
    }
  ]
}

Order by priority (10 = highest priority).`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are an AI assistant specialized in task prioritization for educational consultants. Help optimize workflow and student outcomes."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content || '{"prioritizedTasks": []}');
      return result.prioritizedTasks || [];
    } catch (error) {
      console.error('Error prioritizing tasks:', error);
      return tasks.map(task => ({
        taskId: task.id,
        priority: 5,
        reasoning: 'Default priority assigned due to analysis error'
      }));
    }
  }

  async generateInsights(data: {
    leads: Lead[];
    applications: any[];
    revenue: number;
    period: string;
  }): Promise<{
    insights: string[];
    recommendations: string[];
    trends: Array<{
      metric: string;
      trend: 'up' | 'down' | 'stable';
      change: number;
      significance: 'low' | 'medium' | 'high';
    }>;
  }> {
    try {
      const prompt = `Analyze this educational consulting business data and provide insights, recommendations, and trends.

Data Summary:
- Total Leads: ${data.leads.length}
- Lead Status Distribution: ${this.getStatusDistribution(data.leads)}
- Applications: ${data.applications.length}
- Revenue: $${data.revenue}
- Period: ${data.period}

Lead Sources: ${this.getSourceDistribution(data.leads)}
Program Interests: ${this.getProgramInterestDistribution(data.leads)}

Provide business insights including:
- Performance analysis
- Conversion opportunities
- Market trends
- Operational recommendations
- Growth strategies

Respond with JSON in this format:
{
  "insights": ["insight1", "insight2"],
  "recommendations": ["recommendation1", "recommendation2"],
  "trends": [
    {
      "metric": "metric_name",
      "trend": "up|down|stable",
      "change": percentage_change,
      "significance": "low|medium|high"
    }
  ]
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are an AI business analyst specialized in educational consulting services. Provide actionable insights and strategic recommendations."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
      });

      const result = JSON.parse(response.choices[0].message.content || '{"insights": [], "recommendations": [], "trends": []}');
      return result;
    } catch (error) {
      console.error('Error generating insights:', error);
      return {
        insights: [],
        recommendations: [],
        trends: []
      };
    }
  }

  private getStatusDistribution(leads: Lead[]): string {
    const distribution = leads.reduce((acc, lead) => {
      acc[lead.status || 'unknown'] = (acc[lead.status || 'unknown'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(distribution)
      .map(([status, count]) => `${status}: ${count}`)
      .join(', ');
  }

  private getSourceDistribution(leads: Lead[]): string {
    const distribution = leads.reduce((acc, lead) => {
      acc[lead.source || 'unknown'] = (acc[lead.source || 'unknown'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(distribution)
      .map(([source, count]) => `${source}: ${count}`)
      .join(', ');
  }

  private getProgramInterestDistribution(leads: Lead[]): string {
    const distribution = leads.reduce((acc, lead) => {
      const interest = lead.programInterest || 'unspecified';
      acc[interest] = (acc[interest] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(distribution)
      .slice(0, 5) // Top 5 interests
      .map(([interest, count]) => `${interest}: ${count}`)
      .join(', ');
  }
}

export const aiService = new AIService();

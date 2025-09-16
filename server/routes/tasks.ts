import { Router } from "express";
import { storage } from "../storage";
import { TenantMiddleware } from "../middleware/tenant";
import { aiService } from "../services/aiService";
import { insertTaskSchema } from "@shared/schema";
import { z } from "zod";

const router = Router();

// Get all tasks for tenant/sub-account with filtering
router.get("/", TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const tenantContext = req.tenantContext!;
    const {
      status,
      priority,
      assignedToId,
      dueDate,
      search,
      page = "1",
      limit = "20",
      sortBy = "createdAt",
      sortOrder = "desc"
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    let tasks = await storage.getTasksByTenant(tenantContext.tenantId, tenantContext.subAccountId);

    // Apply filters
    if (status) {
      tasks = tasks.filter(task => task.status === status);
    }

    if (priority) {
      tasks = tasks.filter(task => task.priority === priority);
    }

    if (assignedToId) {
      tasks = tasks.filter(task => task.assignedToId === assignedToId);
    }

    if (dueDate) {
      const dueDateObj = new Date(dueDate as string);
      tasks = tasks.filter(task => {
        const taskDueDate = new Date(task.dueDate);
        return taskDueDate.toDateString() === dueDateObj.toDateString();
      });
    }

    if (search) {
      const searchLower = (search as string).toLowerCase();
      tasks = tasks.filter(task => 
        task.title.toLowerCase().includes(searchLower) ||
        task.description.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    tasks.sort((a, b) => {
      const aValue = a[sortBy as keyof typeof a];
      const bValue = b[sortBy as keyof typeof b];
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // Apply pagination
    const paginatedTasks = tasks.slice(offset, offset + parseInt(limit as string));

    res.json({
      tasks: paginatedTasks,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: tasks.length,
        totalPages: Math.ceil(tasks.length / parseInt(limit as string))
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Create new task with AI prioritization
router.post("/", TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const tenantContext = req.tenantContext!;
    const taskData = insertTaskSchema.parse(req.body);

    // AI-powered task prioritization
    let priority = taskData.priority || 'medium';
    let estimatedDuration = taskData.estimatedDuration;

    try {
      const aiAnalysis = await aiService.analyzeTask({
        title: taskData.title,
        description: taskData.description,
        type: taskData.type,
        dueDate: taskData.dueDate,
        relatedTo: taskData.relatedTo
      });

      if (aiAnalysis.priority) {
        priority = aiAnalysis.priority;
      }
      
      if (aiAnalysis.estimatedDuration) {
        estimatedDuration = aiAnalysis.estimatedDuration;
      }
    } catch (error) {
      console.error('Error analyzing task with AI:', error);
    }

    // Create task with tenant context
    const task = await storage.createTask({
      ...taskData,
      tenantId: tenantContext.tenantId,
      subAccountId: tenantContext.subAccountId || null,
      createdById: tenantContext.userId,
      priority,
      estimatedDuration
    });

    // Schedule reminder if due date is set
    if (task.dueDate) {
      try {
        await aiService.scheduleTaskReminder(task);
      } catch (error) {
        console.error('Error scheduling task reminder:', error);
      }
    }

    // Create activity
    await storage.createActivity({
      tenantId: tenantContext.tenantId,
      subAccountId: tenantContext.subAccountId || null,
      userId: tenantContext.userId,
      taskId: task.id,
      type: "task_created",
      description: `New task created: ${task.title}`,
      metadata: {
        priority: task.priority,
        dueDate: task.dueDate,
        assignedTo: task.assignedToId
      }
    });

    res.status(201).json(task);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: "Validation error", errors: error.errors });
    } else {
      res.status(500).json({ message: error.message });
    }
  }
});

// Get specific task
router.get("/:id", TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const task = await storage.getTask(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Check access permissions
    const tenantContext = req.tenantContext!;
    if (task.tenantId !== tenantContext.tenantId) {
      return res.status(403).json({ message: "Access denied" });
    }
    if (tenantContext.userRole === 'agent' && task.subAccountId !== tenantContext.subAccountId) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(task);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Update task
router.put("/:id", TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const task = await storage.getTask(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Check access permissions
    const tenantContext = req.tenantContext!;
    if (task.tenantId !== tenantContext.tenantId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const updates = insertTaskSchema.partial().parse(req.body);
    const updatedTask = await storage.updateTask(req.params.id, updates);

    // Log status changes
    if (updates.status && updates.status !== task.status) {
      await storage.createActivity({
        tenantId: tenantContext.tenantId,
        subAccountId: tenantContext.subAccountId || null,
        userId: tenantContext.userId,
        taskId: task.id,
        type: "task_status_changed",
        description: `Task status changed from ${task.status} to ${updates.status}`,
        metadata: {
          fromStatus: task.status,
          toStatus: updates.status
        }
      });
    }

    // Log assignment changes
    if (updates.assignedToId && updates.assignedToId !== task.assignedToId) {
      await storage.createActivity({
        tenantId: tenantContext.tenantId,
        subAccountId: tenantContext.subAccountId || null,
        userId: tenantContext.userId,
        taskId: task.id,
        type: "task_assigned",
        description: `Task assigned to user ${updates.assignedToId}`,
        metadata: {
          assignedTo: updates.assignedToId,
          assignedBy: tenantContext.userId
        }
      });
    }

    // Update reminder if due date changed
    if (updates.dueDate && updates.dueDate !== task.dueDate) {
      try {
        await aiService.updateTaskReminder(req.params.id, updates.dueDate);
      } catch (error) {
        console.error('Error updating task reminder:', error);
      }
    }

    res.json(updatedTask);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Delete task
router.delete("/:id", TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const task = await storage.getTask(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Check access permissions
    const tenantContext = req.tenantContext!;
    if (task.tenantId !== tenantContext.tenantId) {
      return res.status(403).json({ message: "Access denied" });
    }

    await storage.deleteTask(req.params.id);

    // Cancel any scheduled reminders
    try {
      await aiService.cancelTaskReminder(req.params.id);
    } catch (error) {
      console.error('Error canceling task reminder:', error);
    }

    // Create activity
    await storage.createActivity({
      tenantId: tenantContext.tenantId,
      subAccountId: tenantContext.subAccountId || null,
      userId: tenantContext.userId,
      taskId: task.id,
      type: "task_deleted",
      description: `Task deleted: ${task.title}`
    });

    res.json({ message: "Task deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Bulk operations on tasks
router.post("/bulk", TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const tenantContext = req.tenantContext!;
    const { operation, taskIds, data } = req.body;

    if (!operation || !taskIds || !Array.isArray(taskIds)) {
      return res.status(400).json({ message: "Invalid bulk operation parameters" });
    }

    const results = [];

    for (const taskId of taskIds) {
      try {
        const task = await storage.getTask(taskId);
        if (!task || task.tenantId !== tenantContext.tenantId) {
          results.push({ taskId, success: false, error: "Task not found or access denied" });
          continue;
        }

        switch (operation) {
          case 'update':
            const updatedTask = await storage.updateTask(taskId, data);
            results.push({ taskId, success: true, task: updatedTask });
            break;
          case 'assign':
            const assignedTask = await storage.updateTask(taskId, { assignedToId: data.userId });
            results.push({ taskId, success: true, task: assignedTask });
            break;
          case 'complete':
            const completedTask = await storage.updateTask(taskId, { 
              status: 'completed',
              completedAt: new Date().toISOString()
            });
            results.push({ taskId, success: true, task: completedTask });
            break;
          case 'delete':
            await storage.deleteTask(taskId);
            results.push({ taskId, success: true });
            break;
          default:
            results.push({ taskId, success: false, error: "Unknown operation" });
        }
      } catch (error) {
        results.push({ taskId, success: false, error: (error as Error).message });
      }
    }

    res.json({ results });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get task statistics
router.get("/stats/overview", TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const tenantContext = req.tenantContext!;
    const tasks = await storage.getTasksByTenant(tenantContext.tenantId, tenantContext.subAccountId);
    
    const stats = {
      total: tasks.length,
      byStatus: tasks.reduce((acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byPriority: tasks.reduce((acc, task) => {
        acc[task.priority] = (acc[task.priority] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      overdue: tasks.filter(task => 
        task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed'
      ).length,
      dueToday: tasks.filter(task => {
        if (!task.dueDate) return false;
        const today = new Date();
        const dueDate = new Date(task.dueDate);
        return dueDate.toDateString() === today.toDateString() && task.status !== 'completed';
      }).length,
      completedThisWeek: tasks.filter(task => {
        if (task.status !== 'completed' || !task.completedAt) return false;
        const completedDate = new Date(task.completedAt);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return completedDate >= weekAgo;
      }).length,
      averageCompletionTime: '3.2 days' // This would be calculated from actual data
    };

    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get AI-powered task recommendations
router.get("/recommendations", TenantMiddleware.requireTenantAccess, async (req, res) => {
  try {
    const tenantContext = req.tenantContext!;
    const tasks = await storage.getTasksByTenant(tenantContext.tenantId, tenantContext.subAccountId);
    
    // Get user's current workload
    const userTasks = tasks.filter(task => task.assignedToId === tenantContext.userId);
    const overdueTasks = userTasks.filter(task => 
      task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed'
    );

    // AI-powered recommendations
    const recommendations = await aiService.generateTaskRecommendations({
      userTasks,
      overdueTasks,
      tenantContext,
      allTasks: tasks
    });

    res.json(recommendations);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
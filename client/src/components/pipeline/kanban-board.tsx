import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  MoreHorizontal, 
  Plus, 
  Settings, 
  BarChart3,
  GripVertical,
  User,
  Mail,
  Phone,
  MapPin,
  Star,
  Clock,
  TrendingUp
} from 'lucide-react';
import { useDrop } from 'react-dnd';
import { useDrag } from 'react-dnd';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { toast } from '@/hooks/use-toast';

interface PipelineStage {
  id: string;
  name: string;
  order: number;
  color: string;
  description?: string;
}

interface PipelineItem {
  id: string;
  type: 'lead' | 'application';
  title: string;
  description?: string;
  status: string;
  priority?: 'low' | 'medium' | 'high';
  assignedTo?: string;
  score?: number;
  createdAt: string;
  updatedAt: string;
  metadata?: {
    email?: string;
    phone?: string;
    location?: string;
    program?: string;
    budget?: string;
  };
}

interface Pipeline {
  id: string;
  name: string;
  type: 'lead' | 'application';
  stages: PipelineStage[];
  isDefault: boolean;
}

interface KanbanBoardProps {
  pipeline: Pipeline;
  items: PipelineItem[];
  onItemMove: (itemId: string, fromStage: string, toStage: string, position?: number) => void;
  onStageUpdate?: (stageId: string, updates: Partial<PipelineStage>) => void;
  onCreateItem?: (stageId: string) => void;
  className?: string;
}

const ItemTypes = {
  PIPELINE_ITEM: 'pipeline_item'
};

interface DraggableItemProps {
  item: PipelineItem;
  index: number;
  onMove: (itemId: string, toStage: string, position?: number) => void;
}

const DraggableItem: React.FC<DraggableItemProps> = ({ item, index, onMove }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.PIPELINE_ITEM,
    item: { id: item.id, status: item.status, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getScoreColor = (score?: number) => {
    if (!score) return 'text-gray-400';
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div
      ref={drag}
      className={`bg-white border rounded-lg p-3 mb-2 cursor-move shadow-sm hover:shadow-md transition-shadow ${
        isDragging ? 'opacity-50' : 'opacity-100'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h4 className="font-medium text-sm mb-1">{item.title}</h4>
          {item.description && (
            <p className="text-xs text-muted-foreground mb-2">{item.description}</p>
          )}
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
          <MoreHorizontal className="w-3 h-3" />
        </Button>
      </div>

      {/* Priority Badge */}
      {item.priority && (
        <Badge variant="outline" className={`text-xs mb-2 ${getPriorityColor(item.priority)}`}>
          {item.priority}
        </Badge>
      )}

      {/* Metadata */}
      <div className="space-y-1 mb-2">
        {item.metadata?.email && (
          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
            <Mail className="w-3 h-3" />
            <span className="truncate">{item.metadata.email}</span>
          </div>
        )}
        {item.metadata?.phone && (
          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
            <Phone className="w-3 h-3" />
            <span>{item.metadata.phone}</span>
          </div>
        )}
        {item.metadata?.location && (
          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3" />
            <span>{item.metadata.location}</span>
          </div>
        )}
      </div>

      {/* Score and Assignment */}
      <div className="flex items-center justify-between">
        {item.score !== undefined && (
          <div className="flex items-center space-x-1">
            <Star className={`w-3 h-3 ${getScoreColor(item.score)}`} />
            <span className={`text-xs font-medium ${getScoreColor(item.score)}`}>
              {item.score}
            </span>
          </div>
        )}
        {item.assignedTo && (
          <div className="flex items-center space-x-1">
            <User className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground truncate">
              {item.assignedTo}
            </span>
          </div>
        )}
      </div>

      {/* Timestamp */}
      <div className="flex items-center space-x-1 mt-2 text-xs text-muted-foreground">
        <Clock className="w-3 h-3" />
        <span>{new Date(item.updatedAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
};

interface StageColumnProps {
  stage: PipelineStage;
  items: PipelineItem[];
  onItemMove: (itemId: string, toStage: string, position?: number) => void;
  onCreateItem?: () => void;
}

const StageColumn: React.FC<StageColumnProps> = ({ stage, items, onItemMove, onCreateItem }) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: ItemTypes.PIPELINE_ITEM,
    drop: (item: { id: string; status: string; index: number }) => {
      if (item.status !== stage.id) {
        onItemMove(item.id, item.status, stage.id);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  return (
    <div
      ref={drop}
      className={`flex-1 min-w-[280px] bg-gray-50 rounded-lg p-3 ${
        isOver ? 'bg-blue-50' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="font-medium text-sm">{stage.name}</h3>
          <Badge variant="secondary" className="text-xs">
            {items.length}
          </Badge>
        </div>
        <div className="flex space-x-1">
          {onCreateItem && (
            <Button variant="ghost" size="sm" onClick={onCreateItem}>
              <Plus className="w-3 h-3" />
            </Button>
          )}
          <Button variant="ghost" size="sm">
            <Settings className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {stage.description && (
        <p className="text-xs text-muted-foreground mb-3">{stage.description}</p>
      )}

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {items.map((item, index) => (
          <DraggableItem
            key={item.id}
            item={item}
            index={index}
            onMove={onItemMove}
          />
        ))}
        {items.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <GripVertical className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <p className="text-xs">No items in this stage</p>
          </div>
        )}
      </div>
    </div>
  );
};

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  pipeline,
  items,
  onItemMove,
  onStageUpdate,
  onCreateItem,
  className = ''
}) => {
  const [localItems, setLocalItems] = useState<PipelineItem[]>(items);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const handleItemMove = useCallback((itemId: string, fromStage: string, toStage: string) => {
    // Update local state immediately for better UX
    setLocalItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId ? { ...item, status: toStage } : item
      )
    );

    // Call the parent handler
    onItemMove(itemId, fromStage, toStage);

    // Show toast notification
    toast({
      title: "Item Moved",
      description: `Item moved to ${pipeline.stages.find(s => s.id === toStage)?.name}`,
    });
  }, [onItemMove, pipeline.stages]);

  const handleCreateItem = useCallback((stageId: string) => {
    if (onCreateItem) {
      onCreateItem(stageId);
    }
  }, [onCreateItem]);

  // Group items by stage
  const itemsByStage = pipeline.stages.map(stage => ({
    stage,
    items: localItems.filter(item => item.status === stage.id)
  }));

  const getPipelineMetrics = () => {
    const totalItems = localItems.length;
    const conversionRate = totalItems > 0 
      ? (itemsByStage[itemsByStage.length - 1]?.items.length || 0) / totalItems * 100 
      : 0;

    return {
      totalItems,
      conversionRate: Math.round(conversionRate * 100) / 100,
      averageTimePerStage: '2.5 days' // This would be calculated from actual data
    };
  };

  const metrics = getPipelineMetrics();

  return (
    <DndProvider backend={HTML5Backend}>
      <div className={`space-y-4 ${className}`}>
        {/* Pipeline Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{pipeline.name}</h2>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
              <div className="flex items-center space-x-1">
                <BarChart3 className="w-4 h-4" />
                <span>{metrics.totalItems} items</span>
              </div>
              <div className="flex items-center space-x-1">
                <TrendingUp className="w-4 h-4" />
                <span>{metrics.conversionRate}% conversion</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="w-4 h-4" />
                <span>{metrics.averageTimePerStage} avg/stage</span>
              </div>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Configure
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Analytics
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Pipeline Analytics</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {itemsByStage.map(({ stage, items }) => (
                    <div key={stage.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        <span className="font-medium">{stage.name}</span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="text-sm">{items.length} items</span>
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${metrics.totalItems > 0 ? (items.length / metrics.totalItems) * 100 : 0}%`
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex space-x-4 overflow-x-auto pb-4">
          {itemsByStage.map(({ stage, items }) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              items={items}
              onItemMove={handleItemMove}
              onCreateItem={() => handleCreateItem(stage.id)}
            />
          ))}
        </div>
      </div>
    </DndProvider>
  );
};
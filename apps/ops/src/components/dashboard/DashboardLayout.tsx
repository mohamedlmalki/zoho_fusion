import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; 
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Ticket, UserPlus, Users, Mail, UserSquare, FileText, AppWindow, FolderKanban, Video, Activity, Wrench, Calendar, GripVertical } from 'lucide-react'; 
import { cn } from '@/lib/utils';
import { ProfileSelector } from './ProfileSelector';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableSidebarItem } from './SortableSidebarItem';

const DEFAULT_MENU_ITEMS = [
  { id: 'desk', to: '/', label: 'Zoho Desk', icon: Ticket },
  { id: 'bookings', to: '/bulk-bookings', label: 'Zoho Bookings', icon: Calendar },
  { id: 'meeting', to: '/bulk-webinar', label: 'Zoho Meeting', icon: Video },
  { id: 'qntrl', to: '/bulk-qntrl', label: 'Zoho Qntrl', icon: AppWindow },
  { id: 'projects', to: '/projects-tasks', label: 'Zoho Projects', icon: FolderKanban },
  { id: 'people', to: '/people-forms', label: 'Zoho People', icon: Users },
  { id: 'creator', to: '/creator-forms', label: 'Zoho Creator', icon: FileText },
  { id: 'fsm', to: '/bulk-contacts-fsm', label: 'Zoho FSM', icon: UserSquare },
  { id: 'catalyst', to: '/catalyst-users', label: 'Zoho Catalyst', icon: UserPlus },
];

export default function DashboardLayout({ children, profiles, selectedProfileId, onProfileSelect, onAddProfile, stats }: any) {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuItems, setMenuItems] = useState(DEFAULT_MENU_ITEMS);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Load order from server on mount
  useEffect(() => {
    fetch('http://localhost:3000/api/sidebar-order')
      .then(res => res.json())
      .then(savedIds => {
        if (savedIds && savedIds.length > 0) {
          const reordered = [...DEFAULT_MENU_ITEMS].sort((a, b) => 
            savedIds.indexOf(a.id) - savedIds.indexOf(b.id)
          );
          setMenuItems(reordered);
        }
      });
  }, []);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setMenuItems((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        const newList = arrayMove(items, oldIndex, newIndex);
        
        // SAVE TO SERVER
        fetch('http://localhost:3000/api/sidebar-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newList.map(i => i.id))
        });
        
        return newList;
      });
    }
  };

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-muted/40 lg:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-[60px] items-center border-b px-6">
            <span className="font-bold text-lg flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              Zoho Ops Center
            </span>
          </div>
          <div className="flex-1 overflow-auto py-2">
            <nav className="grid items-start px-4 text-sm font-medium gap-1">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={menuItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  {menuItems.map((item) => (
                    <SortableSidebarItem key={item.id} id={item.id} to={item.to} icon={item.icon}>
                      {item.label}
                    </SortableSidebarItem>
                  ))}
                </SortableContext>
              </DndContext>
            </nav>
          </div>
          <div className="mt-auto p-4 border-t">
             <ProfileSelector profiles={profiles} selectedProfileId={selectedProfileId} onProfileSelect={onProfileSelect} />
             <Button size="sm" className="w-full mt-2" onClick={onAddProfile}><UserPlus className="h-4 w-4 mr-2" />Add Account</Button>
          </div>
        </div>
      </div>
      <div className="flex flex-col">
         {/* ... Your Header and Main Content ... */}
         {children}
      </div>
    </div>
  );
}
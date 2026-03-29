import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ServiceNavbar } from "./ServiceNavbar"; 
import { Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        {/* 1. Sidebar (Services List) */}
        <AppSidebar />

        {/* 2. Main Content Area */}
        <SidebarInset className="flex flex-col flex-1 min-w-0 bg-background">
            
            {/* Top Bar: Tabs + Progress */}
            <ServiceNavbar />

            {/* Page Content */}
            <div className="flex-1 overflow-auto">
                <Outlet />
            </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
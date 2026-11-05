import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { RolePersonaBar } from './RolePersonaBar';
import { ErrorBoundary } from '../common/ErrorBoundary';

export const AppShell: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Top Interactive Role Persona Bar */}
      <RolePersonaBar />

      <div className="flex-1 flex w-full">
        {/* Dynamic Navigation Sidebar */}
        <Sidebar isCollapsed={isCollapsed} onToggleCollapse={() => setIsCollapsed(!isCollapsed)} />

        {/* Main Content Viewport */}
        <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          <Header />
          <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto animate-in fade-in duration-300">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  );
};

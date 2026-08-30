import React from 'react';
import { Analytics } from '@vercel/analytics/react';
import { ThemeProvider } from './context/ThemeContext';
import { AnalyticsProvider, useAnalytics } from './context/AnalyticsContext';
import { InfrastructureProvider } from './context/InfrastructureContext';
import { AuthProvider } from './context/AuthContext';
import { TooltipProvider } from './components/ui/tooltip';
import { AppHeader } from './components/layout/AppHeader';
import { CollapsibleSidebar } from './components/layout/CollapsibleSidebar';
import { AnalyticsDashboard } from './components/dashboard/AnalyticsDashboard';
import { InfrastructureDashboard } from './components/dashboard/InfrastructureDashboard';

const MainView: React.FC = () => {
  const { activeCategory } = useAnalytics();
  return activeCategory === 'analytics' ? <AnalyticsDashboard /> : <InfrastructureDashboard />;
};

export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={500} skipDelayDuration={300}>
        <AuthProvider>
          <AnalyticsProvider>
            <InfrastructureProvider>
              <div className="flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden">
                <AppHeader />
                <div className="flex flex-1 overflow-hidden">
                  <CollapsibleSidebar />
                  <main className="flex-1 flex flex-col overflow-hidden bg-background">
                    <MainView />
                  </main>
                </div>
              </div>
              <Analytics />
            </InfrastructureProvider>
          </AnalyticsProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}

import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import Leads from "@/pages/leads";
import Applications from "@/pages/applications";
import Universities from "@/pages/universities";
import Pipeline from "@/pages/pipeline";
import Agents from "@/pages/agents";
import Billing from "@/pages/billing";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import StudentPortal from "@/pages/student-portal";
import SubAccounts from "@/pages/sub-accounts";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/leads" component={Leads} />
      <ProtectedRoute path="/applications" component={Applications} />
      <ProtectedRoute path="/universities" component={Universities} />
      <ProtectedRoute path="/pipeline" component={Pipeline} />
      <ProtectedRoute path="/agents" component={Agents} />
      <ProtectedRoute path="/billing" component={Billing} />
      <ProtectedRoute path="/reports" component={Reports} />
      <ProtectedRoute path="/settings" component={Settings} />
      <ProtectedRoute path="/student-portal" component={StudentPortal} />
      <ProtectedRoute path="/sub-accounts" component={SubAccounts} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

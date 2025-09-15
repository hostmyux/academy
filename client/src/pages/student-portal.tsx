import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  FileText, 
  CheckCircle, 
  Clock, 
  Upload, 
  Download,
  MessageSquare,
  User,
  GraduationCap
} from "lucide-react";
import { getUserInitials } from "@/lib/auth-utils";

export default function StudentPortal() {
  const studentData = {
    name: "Sarah Johnson",
    email: "sarah.j@email.com",
    studentId: "STU-2024-001",
    applications: {
      count: 3,
      inProgress: 3,
      submitted: 1,
      accepted: 1,
      pending: 2
    }
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Student Portal</h1>
            <p className="text-muted-foreground">Student self-service portal</p>
          </div>
          
          <Button data-testid="button-message-student">
            <MessageSquare className="w-4 h-4 mr-2" />
            Message Student
          </Button>
        </div>

        {/* Student Profile Header */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-xl font-bold">
                {getUserInitials(studentData.name.split(' ')[0], studentData.name.split(' ')[1])}
              </div>
              <div>
                <h2 className="text-xl font-semibold">{studentData.name}</h2>
                <p className="text-muted-foreground">{studentData.email}</p>
                <p className="text-sm text-muted-foreground">Student ID: {studentData.studentId}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Application Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-chart-3/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-chart-3" />
              </div>
              <h3 className="font-semibold">Applications</h3>
              <p className="text-2xl font-bold text-chart-3 mt-1">{studentData.applications.count}</p>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-chart-2/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-6 h-6 text-chart-2" />
              </div>
              <h3 className="font-semibold">Acceptances</h3>
              <p className="text-2xl font-bold text-chart-2 mt-1">{studentData.applications.accepted}</p>
              <p className="text-sm text-muted-foreground">Received</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-chart-1/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6 text-chart-1" />
              </div>
              <h3 className="font-semibold">Pending</h3>
              <p className="text-2xl font-bold text-chart-1 mt-1">{studentData.applications.pending}</p>
              <p className="text-sm text-muted-foreground">Awaiting Response</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Applications List */}
          <Card>
            <CardHeader>
              <CardTitle>My Applications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border rounded-lg hover:bg-muted/25" data-testid="application-stanford">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-red-700 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">SU</span>
                    </div>
                    <div>
                      <h4 className="font-medium">Stanford University</h4>
                      <p className="text-sm text-muted-foreground">Master of Business Administration</p>
                      <p className="text-xs text-muted-foreground">Application submitted: March 15, 2024</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-chart-2/10 text-chart-2">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Accepted
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">Decision: April 1, 2024</p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 border rounded-lg hover:bg-muted/25" data-testid="application-harvard">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-800 to-red-900 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">HU</span>
                    </div>
                    <div>
                      <h4 className="font-medium">Harvard University</h4>
                      <p className="text-sm text-muted-foreground">Master of Business Administration</p>
                      <p className="text-xs text-muted-foreground">Application submitted: March 10, 2024</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-chart-1/10 text-chart-1">
                      <Clock className="w-3 h-3 mr-1" />
                      Under Review
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">Expected: April 30, 2024</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Document Management */}
          <Card>
            <CardHeader>
              <CardTitle>Document Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drag and drop files here, or click to browse
                </p>
                <Button size="sm" data-testid="button-upload-document">
                  Upload Documents
                </Button>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-5 h-5 text-destructive" />
                    <div>
                      <p className="text-sm font-medium">Transcript.pdf</p>
                      <p className="text-xs text-muted-foreground">2.4 MB • Uploaded March 15, 2024</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className="bg-chart-2 text-white text-xs">Verified</Badge>
                    <Button variant="ghost" size="sm" data-testid="button-download-transcript">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Personal_Statement.docx</p>
                      <p className="text-xs text-muted-foreground">1.8 MB • Uploaded March 12, 2024</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className="bg-chart-2 text-white text-xs">Verified</Badge>
                    <Button variant="ghost" size="sm" data-testid="button-download-statement">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}

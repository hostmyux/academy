import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, RefreshCw, Globe, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { University, Program } from "@shared/schema";

export default function Universities() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const { toast } = useToast();

  const { data: universities, isLoading } = useQuery<University[]>({
    queryKey: ["/api/universities", { search: searchQuery, country: selectedCountry }],
  });

  const handleSyncData = async () => {
    try {
      await apiRequest("POST", "/api/universities/sync", {});
      toast({
        title: "Data sync initiated",
        description: "University database is being updated in the background.",
      });
    } catch (error: any) {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Universities</h1>
            <p className="text-muted-foreground">Browse universities and programs</p>
          </div>
          
          <Button onClick={handleSyncData} variant="outline" data-testid="button-sync-universities">
            <RefreshCw className="w-4 h-4 mr-2" />
            Sync Data
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>University Database</CardTitle>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search universities..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 w-64"
                    data-testid="input-search-universities"
                  />
                </div>
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Filter
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading universities...</div>
            ) : universities && universities.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {universities.map((university) => (
                  <Card key={university.id} className="hover:shadow-md transition-shadow" data-testid={`university-card-${university.id}`}>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div>
                          <h3 className="font-semibold text-lg line-clamp-2">{university.name}</h3>
                          <div className="flex items-center text-sm text-muted-foreground mt-1">
                            <MapPin className="w-4 h-4 mr-1" />
                            {university.city && `${university.city}, `}{university.country}
                          </div>
                        </div>
                        
                        {university.website && (
                          <div className="flex items-center text-sm">
                            <Globe className="w-4 h-4 mr-1" />
                            <a 
                              href={university.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              Visit Website
                            </a>
                          </div>
                        )}
                        
                        {university.ranking?.global && (
                          <Badge variant="secondary">
                            Global Rank: #{university.ranking.global}
                          </Badge>
                        )}
                        
                        <div className="pt-2 border-t">
                          <Button size="sm" className="w-full">
                            View Programs
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No universities found. Try adjusting your search criteria or sync the database.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

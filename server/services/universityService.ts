import { storage } from "../storage";
import type { University, Program, InsertUniversity, InsertProgram } from "@shared/schema";

export class UniversityService {
  private readonly UNIVERSITIES_API = "http://universities.hipolabs.com/search";
  private readonly COLLEGE_SCORECARD_API = "https://api.data.gov/ed/collegescorecard/v1/schools";

  async syncUniversitiesFromAPI(): Promise<void> {
    try {
      console.log("Starting university data sync...");
      
      // Fetch from universities API
      const response = await fetch(this.UNIVERSITIES_API);
      const universities = await response.json();

      let syncedCount = 0;
      
      for (const apiUniversity of universities.slice(0, 100)) { // Limit for demo
        try {
          // Check if university already exists
          const existing = await this.findUniversityByName(apiUniversity.name, apiUniversity.country);
          
          if (!existing) {
            const universityData: InsertUniversity = {
              name: apiUniversity.name,
              country: apiUniversity.country,
              state: apiUniversity["state-province"] || null,
              website: apiUniversity.web_pages?.[0] || null,
              contactInfo: {},
              ranking: {},
              isActive: true,
            };

            await storage.createUniversity(universityData);
            syncedCount++;
          }
        } catch (error) {
          console.error(`Error syncing university ${apiUniversity.name}:`, error);
        }
      }

      console.log(`Synced ${syncedCount} new universities`);
    } catch (error) {
      console.error("Error syncing universities:", error);
      throw error;
    }
  }

  async syncCollegeScorecardData(): Promise<void> {
    try {
      console.log("Starting College Scorecard data sync...");
      
      // This would require a Data.gov API key
      const apiKey = process.env.COLLEGE_SCORECARD_API_KEY || process.env.DATA_GOV_API_KEY;
      
      if (!apiKey) {
        console.log("College Scorecard API key not provided, skipping sync");
        return;
      }

      const response = await fetch(
        `${this.COLLEGE_SCORECARD_API}?api_key=${apiKey}&fields=school.name,school.city,school.state,latest.cost.tuition.in_state,latest.cost.tuition.out_of_state&per_page=100`
      );
      
      const data = await response.json();
      
      for (const school of data.results || []) {
        try {
          const existing = await this.findUniversityByName(school["school.name"], "United States");
          
          if (existing) {
            // Update with cost data
            await storage.updateUniversity(existing.id, {
              contactInfo: {
                ...existing.contactInfo,
                tuition: {
                  inState: school["latest.cost.tuition.in_state"],
                  outOfState: school["latest.cost.tuition.out_of_state"],
                }
              }
            });
          }
        } catch (error) {
          console.error(`Error updating university ${school["school.name"]}:`, error);
        }
      }

      console.log("College Scorecard sync completed");
    } catch (error) {
      console.error("Error syncing College Scorecard data:", error);
    }
  }

  async scrapeProgramData(universityId: string, universityWebsite: string): Promise<void> {
    try {
      // This is a simplified example - in production, you'd use Puppeteer or similar
      console.log(`Scraping program data for university ${universityId} from ${universityWebsite}`);
      
      // Simulated scraping - replace with actual scraping logic
      const samplePrograms = [
        {
          name: "Master of Business Administration",
          degreeType: "Master's",
          field: "Business",
          duration: "2 years",
          language: "English",
          tuitionFee: "45000",
          currency: "USD",
          requirements: {
            gpa: 3.0,
            testScores: { GMAT: 550, GRE: 310 },
            documents: ["Transcripts", "Letters of Recommendation", "Personal Statement"],
            experience: "2 years work experience preferred"
          }
        },
        {
          name: "Master of Science in Computer Science",
          degreeType: "Master's",
          field: "Computer Science",
          duration: "2 years",
          language: "English",
          tuitionFee: "40000",
          currency: "USD",
          requirements: {
            gpa: 3.2,
            testScores: { GRE: 320 },
            documents: ["Transcripts", "Letters of Recommendation", "Statement of Purpose"],
            experience: "Programming experience required"
          }
        }
      ];

      for (const programData of samplePrograms) {
        const program: InsertProgram = {
          universityId,
          ...programData,
          tuitionFee: programData.tuitionFee,
          isActive: true,
        };

        await storage.createProgram(program);
      }

      console.log(`Added ${samplePrograms.length} programs for university ${universityId}`);
    } catch (error) {
      console.error(`Error scraping program data for university ${universityId}:`, error);
    }
  }

  async searchUniversities(query?: string, country?: string, limit = 50): Promise<University[]> {
    return await storage.getUniversities(query, country);
  }

  async searchPrograms(
    query?: string, 
    degreeType?: string, 
    field?: string, 
    universityId?: string
  ): Promise<Program[]> {
    let programs = await storage.searchPrograms(query, degreeType, field);
    
    if (universityId) {
      programs = programs.filter(p => p.universityId === universityId);
    }
    
    return programs;
  }

  async getPopularPrograms(limit = 10): Promise<Program[]> {
    // This would typically use analytics data
    return await storage.searchPrograms(undefined, undefined, undefined);
  }

  async getUniversityRankings(country?: string): Promise<University[]> {
    const universities = await storage.getUniversities(undefined, country);
    
    // Sort by ranking if available
    return universities.sort((a, b) => {
      const aRanking = a.ranking?.global || 999999;
      const bRanking = b.ranking?.global || 999999;
      return aRanking - bRanking;
    });
  }

  private async findUniversityByName(name: string, country: string): Promise<University | undefined> {
    const universities = await storage.getUniversities(name, country);
    return universities.find(u => 
      u.name.toLowerCase().trim() === name.toLowerCase().trim() && 
      u.country.toLowerCase() === country.toLowerCase()
    );
  }

  async scheduleDataSync(): Promise<void> {
    // In production, this would be called by a cron job or scheduled task
    try {
      await this.syncUniversitiesFromAPI();
      await this.syncCollegeScorecardData();
      
      // Scrape program data for universities with websites
      const universities = await storage.getUniversities();
      const universitiesWithWebsites = universities.filter(u => u.website);
      
      for (const university of universitiesWithWebsites.slice(0, 5)) { // Limit for demo
        if (university.website) {
          await this.scrapeProgramData(university.id, university.website);
        }
      }
      
      console.log("University data sync completed");
    } catch (error) {
      console.error("Error in scheduled university sync:", error);
    }
  }

  async getUniversityStats(): Promise<{
    totalUniversities: number;
    totalPrograms: number;
    countriesCount: number;
    lastUpdated: Date | null;
  }> {
    const universities = await storage.getUniversities();
    const allPrograms: Program[] = [];
    
    for (const university of universities) {
      const programs = await storage.getProgramsByUniversity(university.id);
      allPrograms.push(...programs);
    }
    
    const countries = new Set(universities.map(u => u.country));
    const lastUpdated = universities.reduce((latest, u) => {
      if (!latest || (u.lastUpdated && u.lastUpdated > latest)) {
        return u.lastUpdated;
      }
      return latest;
    }, null as Date | null);

    return {
      totalUniversities: universities.length,
      totalPrograms: allPrograms.length,
      countriesCount: countries.size,
      lastUpdated,
    };
  }
}

export const universityService = new UniversityService();

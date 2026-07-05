import { DivisionCards } from "@/components/DivisionCards";
import { FeaturedStories } from "@/components/FeaturedStories";
import { Hero } from "@/components/Hero";
import { MediaSection } from "@/components/MediaSection";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { Rankings } from "@/components/Rankings";
import { RecruitingResources } from "@/components/RecruitingResources";
import { Spotlights } from "@/components/Spotlights";

export default function HomePage() {
  return <><Hero /><DivisionCards /><FeaturedStories /><RecruitingResources /><Spotlights /><Rankings /><MediaSection /><NewsletterSignup /></>;
}

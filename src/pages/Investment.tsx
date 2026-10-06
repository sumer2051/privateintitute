import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { InvestmentIcon } from "@/components/InvestmentSwitch";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";

export default function Investment() {
  const navigate = useNavigate();
  return (
    <AuthLayout currentPage="investment">
      <Seo title="Investment account | BoA private institute" description="Private investment account workspace." path="/investment" noindex />
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-3">
          <InvestmentIcon className="h-10 w-10" />
          <h2 className="text-2xl font-semibold text-foreground">Investment account</h2>
        </div>
        <Button variant="outline" onClick={() => navigate("/accounts")}><ArrowLeft className="mr-2 h-4 w-4" />Back to banking</Button>
      </div>
    </AuthLayout>
  );
}
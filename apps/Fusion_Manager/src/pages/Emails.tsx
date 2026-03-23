import { useAccount } from "@/contexts/AccountContext";
import ButtondownEmails from "./buttondown/Emails";
// import BenchmarkEmails from "./benchmark/Emails"; // Uncomment when Benchmark Emails page is created

export default function Emails() {
  const { activeAccount } = useAccount();

  if (!activeAccount) {
    return <div className="p-8 text-center">Please select an account.</div>;
  }

  switch (activeAccount.provider) {
    case 'buttondown':
      return <ButtondownEmails />;
    case 'benchmark':
       // return <BenchmarkEmails />; 
       return <div className="p-8 text-center">Benchmark Emails module coming soon.</div>;
    default:
      return (
        <div className="p-8 text-center text-muted-foreground">
          Email management is not available for {activeAccount.name} ({activeAccount.provider}).
        </div>
      );
  }
}
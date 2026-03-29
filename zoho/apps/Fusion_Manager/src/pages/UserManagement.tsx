import { useAccount } from "@/contexts/AccountContext";
import ActiveCampaignUsers from "./activecampaign/UserManagement";
import BenchmarkUsers from "./benchmark/UserManagement";
import ButtondownUsers from "./buttondown/UserManagement"; // <--- NEW IMPORT

export default function UserManagement() {
  const { activeAccount } = useAccount();

  if (!activeAccount) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Please select an account from the sidebar.
      </div>
    );
  }

  switch (activeAccount.provider) {
    case 'activecampaign':
      return <ActiveCampaignUsers />;
    case 'benchmark':
      return <BenchmarkUsers />;
    case 'buttondown':
      return <ButtondownUsers />; // <--- NEW CASE
    case 'omnisend':
      return (
        <div className="p-8 text-center text-muted-foreground">
          User Management is not supported for Omnisend yet.
        </div>
      );
    default:
      return <div>Unknown provider: {activeAccount.provider}</div>;
  }
}
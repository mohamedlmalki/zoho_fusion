import { useAccount } from "@/contexts/AccountContext";
import ButtondownSendEmail from "./buttondown/SendEmail";

export default function SendEmail() {
  const { activeAccount } = useAccount();

  if (!activeAccount) {
    return <div className="p-8 text-center">Please select an account.</div>;
  }

  switch (activeAccount.provider) {
    case 'buttondown':
      return <ButtondownSendEmail />;
    default:
      return (
        <div className="p-8 text-center text-muted-foreground">
          Sending emails is not configured for {activeAccount.name} ({activeAccount.provider}).
        </div>
      );
  }
}
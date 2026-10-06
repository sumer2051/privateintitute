import { createRoot } from "react-dom/client";
import "./index.css";
import { TransferReceipt, type ReceiptData } from "@/components/TransferReceipt";
import { getCountryMethods } from "@/lib/country-methods";

const q = new URLSearchParams(window.location.search);
const id = q.get("m") || "faster_payments";
const method = getCountryMethods("GBP").find((m) => m.id === id) ?? getCountryMethods("GBP")[0];

const fields: Record<string, string> = {
  recipient_name: "RAIVIS SKUDRA",
  bank: "Monzo Bank",
  sort_code: "04-00-75",
  account: "87654321",
  reference: "RENT-204",
};
if (!q.has("nofee")) fields["Service Fee"] = "2.50";

const receipt: ReceiptData = {
  method,
  amount: 80,
  currencyCode: "GBP",
  currencySymbol: "£",
  senderName: "Jane Doe",
  recipientName: "RAIVIS SKUDRA",
  recipientEmail: "",
  fields,
  note: q.has("nonote") ? undefined : "Monthly rent",
  reference: "RENT-204",
  timestamp: new Date().toISOString(),
  fromLabel: "Checking Account · ****1234",
};

createRoot(document.getElementById("root")!).render(
  <TransferReceipt open onClose={() => undefined} receipt={receipt} />
);

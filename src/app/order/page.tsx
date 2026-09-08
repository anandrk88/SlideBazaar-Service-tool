import { getCurrentUser } from "@/lib/auth";
import { loadCalendar } from "@/lib/calendar-server";
import { loadCatalog } from "@/lib/catalog-server";
import { OrderWizard } from "@/components/wizard/OrderWizard";

export const metadata = { title: "Order custom slide design | SlideBazaar" };
export const dynamic = "force-dynamic";

export default async function OrderPage() {
  const [user, calendar, catalog] = await Promise.all([getCurrentUser(), loadCalendar(), loadCatalog()]);
  return <OrderWizard initialUser={user} calendar={calendar} catalog={catalog} />;
}

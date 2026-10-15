import { ManagerTasks } from "../portal";

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ employee?: string }> }) {
  const { employee } = await searchParams;
  return <ManagerTasks key={employee || "all"} employeeId={employee} />;
}

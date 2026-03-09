import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DarUpload } from "@/components/developer/dar-upload";

interface Props {
  params: Promise<{ appId: string }>;
}

export default async function NewVersionPage({ params }: Props) {
  const { appId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const app = await db.app.findUnique({
    where: { id: appId },
    select: { id: true, developerId: true, name: true },
  });

  if (!app || app.developerId !== session.user.id) notFound();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">
        Upload Version for {app.name}
      </h1>
      <DarUpload appId={app.id} />
    </div>
  );
}

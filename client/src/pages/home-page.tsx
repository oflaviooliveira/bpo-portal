import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { AdminLayout } from "@/layouts/AdminLayout";
import { ClientLayout } from "@/layouts/ClientLayout";
import { SharedDataProvider } from "@/providers/SharedDataProvider";

export default function HomePage() {
  const { user } = useAuth();
  
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isClientUser = user?.role === 'CLIENT_USER';

  // Provider compartilhado para comunicação entre painéis
  return (
    <SharedDataProvider>
      {isSuperAdmin && <AdminLayout />}
      {isClientUser && <ClientLayout />}
    </SharedDataProvider>
  );
}

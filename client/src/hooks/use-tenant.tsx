
import React, { createContext, useContext, useEffect, useState } from 'react';

interface TenantContextType {
  tenantSlug: string;
  tenantName: string;
  setTenant: (slug: string, name: string) => void;
}

const TenantContext = createContext<TenantContextType | null>(null);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenantSlug, setTenantSlug] = useState('acme-log');
  const [tenantName, setTenantName] = useState('ACME Logística');

  const setTenant = (slug: string, name: string) => {
    setTenantSlug(slug);
    setTenantName(name);
    localStorage.setItem('currentTenant', JSON.stringify({ slug, name }));
  };

  useEffect(() => {
    const saved = localStorage.getItem('currentTenant');
    if (saved) {
      const { slug, name } = JSON.parse(saved);
      setTenantSlug(slug);
      setTenantName(name);
    }
  }, []);

  return (
    <TenantContext.Provider value={{ tenantSlug, tenantName, setTenant }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant deve ser usado dentro de TenantProvider');
  }
  return context;
}

// Helper para construir URLs com tenant
export function useTenantUrl(path: string) {
  const { tenantSlug } = useTenant();
  return `/${tenantSlug}/api${path}`;
}

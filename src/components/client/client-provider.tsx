"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Client {
  id: string;
  telegramUserId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  totalRequests: number;
  totalVolume: number;
  isBlocked: boolean;
}

interface ClientContextType {
  client: Client | null;
  isLoading: boolean;
  login: (telegramUserId: string, username?: string, firstName?: string) => Promise<void>;
  logout: () => void;
  updateClient: (updates: Partial<Client>) => void;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

export function ClientProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Проверяем, есть ли сохраненные данные клиента
    const savedClient = localStorage.getItem("crypto-client");
    if (savedClient) {
      try {
        setClient(JSON.parse(savedClient));
      } catch (error) {
        console.error("Error parsing saved client data:", error);
        localStorage.removeItem("crypto-client");
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (
    telegramUserId: string, 
    username?: string, 
    firstName?: string, 
    lastName?: string, 
    phone?: string
  ) => {
    try {
      setIsLoading(true);
      
      // Создаем или получаем клиента через API
      const response = await fetch("/api/client/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          telegramUserId,
          username,
          firstName,
          lastName,
          phone,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to authenticate client");
      }

      const clientData = await response.json();
      setClient(clientData);
      localStorage.setItem("crypto-client", JSON.stringify(clientData));
      
      // Не показываем toast здесь, пусть страница auth покажет соответствующее сообщение
    } catch (error) {
      console.error("Login error:", error);
      throw error; // Пробрасываем ошибку для обработки в компоненте
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setClient(null);
    localStorage.removeItem("crypto-client");
    router.push("/client");
    toast.success("Вы вышли из системы");
  };

  const updateClient = (updates: Partial<Client>) => {
    if (client) {
      const updatedClient = { ...client, ...updates };
      setClient(updatedClient);
      localStorage.setItem("crypto-client", JSON.stringify(updatedClient));
    }
  };

  return (
    <ClientContext.Provider value={{ client, isLoading, login, logout, updateClient }}>
      {children}
    </ClientContext.Provider>
  );
}

export function useClient() {
  const context = useContext(ClientContext);
  if (context === undefined) {
    throw new Error("useClient must be used within a ClientProvider");
  }
  return context;
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Wallet, Loader2, Coins } from "lucide-react";
import { toast } from "sonner";

interface Coin {
  contractId: string;
  amount: string;
  currency: string;
}

interface WalletData {
  balance: string;
  coins: Coin[];
}

export default function ValidatorWalletPage() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mintAmount, setMintAmount] = useState("");
  const [minting, setMinting] = useState(false);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet/balance");
      if (!res.ok) throw new Error("Failed to fetch balance");
      const { data } = await res.json();
      setWallet(data);
    } catch {
      toast.error("Failed to load wallet");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  async function handleMint() {
    const amount = parseFloat(mintAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setMinting(true);
    try {
      const res = await fetch("/api/wallet/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      if (res.status === 403) {
        toast.error("Minting only available in dev mode");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Mint failed");
      }

      toast.success(`Minted ${amount} CC`);
      setMintAmount("");
      await fetchBalance();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Mint failed";
      toast.error(message);
    } finally {
      setMinting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Wallet</h1>

      {/* Balance Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            CC Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Wallet className="h-8 w-8 text-primary" />
            <span className="text-4xl font-bold">
              {wallet?.balance ?? "0.00"}
            </span>
            <span className="text-lg text-muted-foreground">CC</span>
          </div>
        </CardContent>
      </Card>

      {/* Coins List */}
      {wallet?.coins && wallet.coins.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Coins className="h-4 w-4" />
              Coin Contracts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract ID</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallet.coins.map((coin) => (
                  <TableRow key={coin.contractId}>
                    <TableCell className="font-mono text-xs">
                      {coin.contractId.length > 24
                        ? `${coin.contractId.slice(0, 12)}...${coin.contractId.slice(-12)}`
                        : coin.contractId}
                    </TableCell>
                    <TableCell className="text-right">
                      {coin.amount} {coin.currency}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Mint Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mint CC (Test)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="mint-amount">Amount</Label>
              <Input
                id="mint-amount"
                type="number"
                min="1"
                step="any"
                placeholder="100"
                value={mintAmount}
                onChange={(e) => setMintAmount(e.target.value)}
              />
            </div>
            <Button onClick={handleMint} disabled={minting}>
              {minting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mint CC
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

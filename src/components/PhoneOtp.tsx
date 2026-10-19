import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toE164SA } from "@/lib/phone";

export function PhoneOtp() {
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const e164 = toE164SA(phone);
    if (!e164) { toast.error("Enter a valid SA cell number, e.g. 072 123 4567"); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
    setBusy(false);
    if (error) { toast.error(`Could not send SMS: ${error.message}`); return; }
    setSentTo(e164);
    toast.success(`Code sent to ${e164}`);
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sentTo) return;
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone: sentTo, token: code.trim(), type: "sms" });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Number verified — welcome!");
  };

  if (sentTo)
    return (
      <form onSubmit={verify} className="mt-4 space-y-4">
        <p className="text-sm text-muted-foreground">Enter the 6-digit code we sent to <b>{sentTo}</b>.</p>
        <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" />
        <Button className="w-full" disabled={busy || code.length < 6}>{busy ? "Verifying…" : "Verify & continue"}</Button>
        <button type="button" className="text-sm text-muted-foreground hover:underline" onClick={() => { setSentTo(null); setCode(""); }}>Use a different number</button>
      </form>
    );

  return (
    <form onSubmit={send} className="mt-4 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="phone">Cell number</Label>
        <Input id="phone" type="tel" inputMode="tel" required placeholder="072 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <Button className="w-full" disabled={busy}>{busy ? "Sending…" : "Send me a code"}</Button>
      <p className="text-xs text-muted-foreground">Use the number you gave the school. Once verified, your children appear automatically.</p>
    </form>
  );
}

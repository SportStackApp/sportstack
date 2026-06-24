import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Extend the Profile type locally to match what UsersManagement.tsx expects
interface ProfileWithExtensions {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  street_address?: string | null;
  suburb?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  email?: string | null;
  is_placeholder?: boolean | null;
  revsports_player_id?: string | null;
}

interface EditUserDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ProfileWithExtensions | null;
  onSuccess: () => void;
}

export const EditUserDetailsDialog = ({
  open,
  onOpenChange,
  user,
  onSuccess,
}: EditUserDetailsDialogProps) => {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Form Fields
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [suburb, setSuburb] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");

  const user_first_name = user?.first_name;
  const user_last_name = user?.last_name;
  const user_phone = user?.phone;
  const user_street_address = user?.street_address;
  const user_suburb = user?.suburb;
  const user_date_of_birth = user?.date_of_birth;
  const user_gender = user?.gender;
  const user_emergency_contact_name = user?.emergency_contact_name;
  const user_emergency_contact_phone = user?.emergency_contact_phone;
  const user_email = user?.email;

  useEffect(() => {
    if (!open || !user?.id) return;

    // Reset local state to selected user details
    setFirstName(user_first_name || "");
    setLastName(user_last_name || "");
    setPhone(user_phone || "");
    setStreetAddress(user_street_address || "");
    setSuburb(user_suburb || "");
    setDateOfBirth(user_date_of_birth || "");
    setGender(user_gender || "");
    setEmergencyContactName(user_emergency_contact_name || "");
    setEmergencyContactPhone(user_emergency_contact_phone || "");
    setEmail(user_email || "");
    setErrorMsg("");

    const fetchUserDetails = async () => {
      setLoading(true);
      try {
        // Try calling the function using GET first
        let res = await supabase.functions.invoke("update-user-details", {
          method: "GET",
          headers: {
            "x-user-id": user.id,
          },
        });

        // Fall back to POST with action 'get' if GET fails or returns no email
        if (!res.data || res.error) {
          res = await supabase.functions.invoke("update-user-details", {
            body: { user_id: user.id, action: "get" },
          });
        }

        if (res.data && !res.error) {
          const data = res.data;
          if (data.email) setEmail(data.email);
          if (data.first_name) setFirstName(data.first_name);
          if (data.last_name) setLastName(data.last_name);
          if (data.phone) setPhone(data.phone);
          if (data.street_address) setStreetAddress(data.street_address);
          if (data.suburb) setSuburb(data.suburb);
          if (data.date_of_birth) setDateOfBirth(data.date_of_birth);
          if (data.gender) setGender(data.gender);
          if (data.emergency_contact_name) setEmergencyContactName(data.emergency_contact_name);
          if (data.emergency_contact_phone) setEmergencyContactPhone(data.emergency_contact_phone);
        }
      } catch (err) {
        console.error("Exception fetching user details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserDetails();
  }, [
    open,
    user?.id,
    user_first_name,
    user_last_name,
    user_phone,
    user_street_address,
    user_suburb,
    user_date_of_birth,
    user_gender,
    user_emergency_contact_name,
    user_emergency_contact_phone,
    user_email,
  ]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setSaving(true);
    setErrorMsg("");

    try {
      const { data, error } = await supabase.functions.invoke("update-user-details", {
        body: {
          user_id: user.id,
          email: email.trim(),
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          phone: phone.trim() || null,
          street_address: streetAddress.trim() || null,
          suburb: suburb.trim() || null,
          date_of_birth: dateOfBirth || null,
          gender: gender || null,
          emergency_contact_name: emergencyContactName.trim() || null,
          emergency_contact_phone: emergencyContactPhone.trim() || null,
        },
      });

      if (error || data?.error) {
        const errMsg = data?.error || error?.message || "Failed to update user details.";
        setErrorMsg(errMsg);
        setSaving(false);
        return;
      }

      toast({
        title: "Details Updated",
        description: "User details have been successfully updated.",
      });
      setSaving(false);
      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      console.error("Exception saving user details:", err);
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message);
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Details</DialogTitle>
          <DialogDescription>
            Update the profile information and email address for this user.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading details...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6 py-2">
            {errorMsg && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p className="font-medium">{errorMsg}</p>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>

            {/* Names */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first-name">First name</Label>
                <Input
                  id="first-name"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-name">Last name</Label>
                <Input
                  id="last-name"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                />
              </div>
            </div>

            {/* Contact details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="suburb">Suburb</Label>
                <Input
                  id="suburb"
                  value={suburb}
                  onChange={(e) => setSuburb(e.target.value)}
                  placeholder="Suburb"
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="street-address">Street address</Label>
              <Input
                id="street-address"
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                placeholder="Street address"
              />
            </div>

            {/* DOB & Gender */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date-of-birth">Date of birth</Label>
                <Input
                  id="date-of-birth"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select value={gender || "__none__"} onValueChange={(val) => setGender(val === "__none__" ? "" : val)}>
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select gender</SelectItem>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Emergency Contact</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergency-contact-name">Emergency contact name</Label>
                  <Input
                    id="emergency-contact-name"
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    placeholder="Contact name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergency-contact-phone">Emergency contact phone</Label>
                  <Input
                    id="emergency-contact-phone"
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    placeholder="Contact phone number"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="border-t pt-4 gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

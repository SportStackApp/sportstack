import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Phone, MapPin, Calendar, AlertCircle, Save, User, X } from "lucide-react";

interface PersonalDetailsSectionProps {
  email: string;
  isEditing: boolean;
  formData: {
    firstName: string;
    lastName: string;
    phone: string;
    suburb: string;
    dateOfBirth: string;
    gender: string;
    emergencyContact: {
      name: string;
      phone: string;
      relationship: string;
    };
  };
  onFormChange: (data: Partial<PersonalDetailsSectionProps["formData"]>) => void;
  onSave: () => void;
  onCancel: () => void;
  onEdit: () => void;
  requiresReview?: boolean;
}

export const PersonalDetailsSection = ({
  email,
  isEditing,
  formData,
  onFormChange,
  onSave,
  onCancel,
  onEdit,
  requiresReview = false,
}: PersonalDetailsSectionProps) => {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg">Personal Details</CardTitle>
          {requiresReview && (
            <p className="mt-1 text-sm text-muted-foreground">
              Please confirm these details before continuing.
            </p>
          )}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {isEditing ? (
            <>
              {!requiresReview && (
                <Button variant="outline" size="sm" onClick={onCancel} className="w-full sm:w-auto">
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              )}
              <Button size="sm" onClick={onSave} className="w-full sm:w-auto">
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={onEdit} className="w-full sm:w-auto">
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Row 1: First Name | Last Name */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name{requiresReview ? " *" : ""}</Label>
            {isEditing ? (
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => onFormChange({ firstName: e.target.value })}
                required={requiresReview}
              />
            ) : (
              <p className="text-foreground py-2">{formData.firstName || "Not set"}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name{requiresReview ? " *" : ""}</Label>
            {isEditing ? (
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => onFormChange({ lastName: e.target.value })}
                required={requiresReview}
              />
            ) : (
              <p className="text-foreground py-2">{formData.lastName || "Not set"}</p>
            )}
          </div>
        </div>

        {/* Row 2: Email (read-only) | Phone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <div className="flex items-center gap-2 py-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <p className="text-foreground">{email}</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number{requiresReview ? " *" : ""}</Label>
            {isEditing ? (
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => onFormChange({ phone: e.target.value })}
                placeholder="0400 000 000"
                required={requiresReview}
              />
            ) : (
              <div className="flex items-center gap-2 py-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <p className="text-foreground">{formData.phone || "Not set"}</p>
              </div>
            )}
          </div>
        </div>

        {/* Row 3: Address (full width) */}
        <div className="space-y-2">
          <Label htmlFor="suburb">Address</Label>
          {isEditing ? (
            <Textarea
              id="suburb"
              value={formData.suburb}
              onChange={(e) => onFormChange({ suburb: e.target.value })}
              placeholder="Enter your full address"
              rows={3}
            />
          ) : (
            <div className="flex items-center gap-2 py-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <p className="text-foreground">{formData.suburb || "Not set"}</p>
            </div>
          )}
        </div>

        {/* Row 4: Date of Birth | Gender */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dob">Date of Birth{requiresReview ? " *" : ""}</Label>
            {isEditing ? (
              <Input
                id="dob"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => onFormChange({ dateOfBirth: e.target.value })}
                required={requiresReview}
                className="w-full min-w-0"
              />
            ) : (
              <div className="flex items-center gap-2 py-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <p className="text-foreground">
                  {formData.dateOfBirth
                    ? new Date(formData.dateOfBirth).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "Not set"}
                </p>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Gender{requiresReview ? " *" : ""}</Label>
            {isEditing ? (
              <Select
                value={formData.gender}
                onValueChange={(v) => onFormChange({ gender: v })}
              >
                <SelectTrigger aria-required={requiresReview}>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2 py-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <p className="text-foreground">{formData.gender || "Not set"}</p>
              </div>
            )}
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="space-y-3 pt-2">
          <Label className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            Emergency Contact
          </Label>
          {isEditing ? (
            <div className="space-y-3 pl-6">
              <div className="space-y-1">
                <Label htmlFor="ec-name" className="text-xs text-muted-foreground">
                  Name
                </Label>
                <Input
                  id="ec-name"
                  value={formData.emergencyContact.name}
                  onChange={(e) =>
                    onFormChange({
                      emergencyContact: { ...formData.emergencyContact, name: e.target.value },
                    })
                  }
                  placeholder="Contact name"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ec-phone" className="text-xs text-muted-foreground">
                  Phone
                </Label>
                <Input
                  id="ec-phone"
                  value={formData.emergencyContact.phone}
                  onChange={(e) =>
                    onFormChange({
                      emergencyContact: { ...formData.emergencyContact, phone: e.target.value },
                    })
                  }
                  placeholder="Contact phone"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ec-relationship" className="text-xs text-muted-foreground">
                  Relationship
                </Label>
                <Input
                  id="ec-relationship"
                  value={formData.emergencyContact.relationship}
                  onChange={(e) =>
                    onFormChange({
                      emergencyContact: {
                        ...formData.emergencyContact,
                        relationship: e.target.value,
                      },
                    })
                  }
                  placeholder="e.g. Spouse, Parent"
                />
              </div>
            </div>
          ) : (
            <div className="pl-6 space-y-1">
              <p className="text-foreground font-medium">
                {formData.emergencyContact.name || "Not set"}
              </p>
              {formData.emergencyContact.phone && (
                <p className="text-sm text-muted-foreground">
                  {formData.emergencyContact.phone} • {formData.emergencyContact.relationship}
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

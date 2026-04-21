import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAgencyUsers,
  useInviteAgent,
  useUpdateUserRole,
  getListAgencyUsersQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Mail, Shield, User } from "lucide-react";
import { format } from "date-fns";
import { useAgencyUser } from "@/hooks/useAgencyUser";
import { Redirect } from "wouter";

export default function TeamPage() {
  const { isAdmin, isLoading: roleLoading } = useAgencyUser();
  const { data: users, isLoading } = useListAgencyUsers({ query: { enabled: isAdmin } });
  const inviteAgent = useInviteAgent();
  const updateUserRole = useUpdateUserRole();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"agent" | "admin">("agent");

  if (!roleLoading && !isAdmin) {
    return <Redirect to="/dashboard" />;
  }

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    const signUpUrl = `${window.location.origin}${import.meta.env.BASE_URL}sign-up`;

    inviteAgent.mutate(
      { data: { email: inviteEmail.trim(), role: inviteRole, redirectUrl: signUpUrl } },
      {
        onSuccess: () => {
          toast({ title: `Invitation sent to ${inviteEmail}` });
          setInviteEmail("");
        },
        onError: (err: any) => {
          toast({
            title: "Failed to send invitation",
            description: err?.data?.error || "Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleRoleChange = (clerkUserId: string, newRole: string) => {
    updateUserRole.mutate(
      { id: clerkUserId, data: { role: newRole } },
      {
        onSuccess: () => {
          toast({ title: "Role updated" });
          queryClient.invalidateQueries({ queryKey: getListAgencyUsersQueryKey() });
        },
        onError: () => {
          toast({ title: "Failed to update role", variant: "destructive" });
        },
      }
    );
  };

  const getInitials = (user: { fullName?: string | null; email?: string | null }) => {
    if (user.fullName) {
      return user.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return user.email?.charAt(0).toUpperCase() ?? "?";
  };

  return (
    <Layout>
      <div className="flex flex-col gap-8 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Team</h1>
          <p className="text-muted-foreground mt-1">Manage your agency's agents and administrators.</p>
        </div>

        {/* Invite Agent Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserPlus className="w-5 h-5 text-teal-600" />
              Invite Team Member
            </CardTitle>
            <CardDescription>
              Send an email invitation to add a new agent or admin to your agency.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Label htmlFor="invite-email" className="sr-only">
                  Email address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="agent@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as any)}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="submit"
                className="bg-teal-600 hover:bg-teal-700 text-white shrink-0"
                disabled={inviteAgent.isPending}
              >
                {inviteAgent.isPending ? "Sending…" : "Send Invite"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Team Members List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Team Members</CardTitle>
            <CardDescription>
              {users?.length ?? 0} member{users?.length !== 1 ? "s" : ""} in your agency
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-32" />
                      <div className="h-3 bg-muted rounded w-48" />
                    </div>
                  </div>
                ))}
              </div>
            ) : users?.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <User className="w-8 h-8 mx-auto mb-2 text-muted" />
                <p>No team members yet. Send an invite to get started.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {users?.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/20 transition-colors"
                  >
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarFallback
                        className={`text-sm font-semibold ${
                          user.role === "admin"
                            ? "bg-teal-100 text-teal-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {getInitials(user)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {user.fullName || user.email || "Unnamed user"}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-xs shrink-0 ${
                            user.role === "admin"
                              ? "border-teal-200 bg-teal-50 text-teal-700"
                              : "border-slate-200 bg-slate-50 text-slate-600"
                          }`}
                        >
                          {user.role === "admin" ? (
                            <><Shield className="w-3 h-3 mr-1" />Admin</>
                          ) : (
                            <><User className="w-3 h-3 mr-1" />Agent</>
                          )}
                        </Badge>
                      </div>
                      {user.email && user.fullName && (
                        <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Joined {format(new Date(user.createdAt), "MMM d, yyyy")}
                      </div>
                    </div>
                    <Select
                      value={user.role}
                      onValueChange={(v) => handleRoleChange(user.clerkUserId, v)}
                    >
                      <SelectTrigger className="w-28 h-8 text-xs shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="agent">Agent</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

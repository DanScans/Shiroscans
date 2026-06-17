import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { Settings as SettingsIcon, User, Lock, Trash2 } from "lucide-react";
import {
  useGetMe, getGetMeQueryKey,
  useGetProfile, getGetProfileQueryKey,
  useUpdateProfile, useChangePassword, useDeleteAccount, useLogout,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import SectionHeader from "@/components/SectionHeader";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const profileSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").optional(),
  bio: z.string().max(200, "Bio must be 200 characters or less").optional(),
  avatarUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: user } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { data: profile } = useGetProfile({ query: { enabled: !!user, queryKey: getGetProfileQueryKey() } });

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: { username: profile?.username ?? "", bio: profile?.bio ?? "", avatarUrl: profile?.avatarUrl ?? "" },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const updateProfile = useUpdateProfile({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast({ description: "Profile updated!" });
      },
      onError: () => toast({ description: "Failed to update profile", variant: "destructive" }),
    },
  });

  const changePassword = useChangePassword({
    mutation: {
      onSuccess: () => {
        passwordForm.reset();
        toast({ description: "Password changed!" });
      },
      onError: () => toast({ description: "Current password is incorrect", variant: "destructive" }),
    },
  });

  const deleteAccount = useDeleteAccount({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/");
        toast({ description: "Account deleted" });
      },
    },
  });

  const logout = useLogout({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/");
      },
    },
  });

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <SettingsIcon className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Sign in to access settings</h2>
        <Button asChild className="bg-primary hover:bg-primary/90 mt-4"><Link href="/login">Sign In</Link></Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <SectionHeader title="Settings" accent />

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="bg-card border border-white/10 w-full justify-start mb-6">
          <TabsTrigger value="profile" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <User className="w-4 h-4" /> Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Lock className="w-4 h-4" /> Security
          </TabsTrigger>
          <TabsTrigger value="danger" className="gap-2 data-[state=active]:bg-destructive/20 data-[state=active]:text-destructive">
            <Trash2 className="w-4 h-4" /> Danger Zone
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="bg-card rounded-2xl border border-white/[0.08] p-6">
            <h3 className="text-lg font-semibold text-white mb-5">Edit Profile</h3>
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit((d) => updateProfile.mutate({ data: d }))} className="space-y-4" data-testid="form-profile">
                <FormField control={profileForm.control} name="username" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#9CA3AF]">Username</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} className="bg-secondary border-white/10 text-white" data-testid="input-username" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={profileForm.control} name="bio" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#9CA3AF]">Bio</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value ?? ""} placeholder="Tell us about yourself..." className="bg-secondary border-white/10 text-white resize-none" rows={3} data-testid="input-bio" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={profileForm.control} name="avatarUrl" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#9CA3AF]">Avatar URL</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="https://..." className="bg-secondary border-white/10 text-white" data-testid="input-avatar-url" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={updateProfile.isPending} data-testid="button-save-profile">
                  {updateProfile.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </Form>
          </div>
        </TabsContent>

        <TabsContent value="security">
          <div className="bg-card rounded-2xl border border-white/[0.08] p-6">
            <h3 className="text-lg font-semibold text-white mb-5">Change Password</h3>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit((d) => changePassword.mutate({ data: { currentPassword: d.currentPassword, newPassword: d.newPassword } }))} className="space-y-4" data-testid="form-password">
                <FormField control={passwordForm.control} name="currentPassword" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#9CA3AF]">Current Password</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" className="bg-secondary border-white/10 text-white" data-testid="input-current-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={passwordForm.control} name="newPassword" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#9CA3AF]">New Password</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" className="bg-secondary border-white/10 text-white" data-testid="input-new-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={passwordForm.control} name="confirmPassword" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#9CA3AF]">Confirm New Password</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" className="bg-secondary border-white/10 text-white" data-testid="input-confirm-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={changePassword.isPending} data-testid="button-change-password">
                  {changePassword.isPending ? "Changing..." : "Change Password"}
                </Button>
              </form>
            </Form>
          </div>
        </TabsContent>

        <TabsContent value="danger">
          <div className="bg-card rounded-2xl border border-destructive/20 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white mb-2">Danger Zone</h3>

            <div className="flex items-center justify-between p-4 rounded-xl bg-secondary border border-white/10">
              <div>
                <p className="text-sm font-medium text-white">Sign Out</p>
                <p className="text-xs text-[#9CA3AF] mt-0.5">Sign out of your account on this device</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => logout.mutate(undefined)} className="border-white/10 shrink-0" data-testid="button-logout">
                Sign Out
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-destructive/10 border border-destructive/20">
              <div>
                <p className="text-sm font-medium text-destructive">Delete Account</p>
                <p className="text-xs text-[#9CA3AF] mt-0.5">Permanently delete your account and all data</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="shrink-0" data-testid="button-delete-account">
                    Delete Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-white/10">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete account?</AlertDialogTitle>
                    <AlertDialogDescription className="text-[#9CA3AF]">
                      This will permanently delete your account, bookmarks, history, and all other data. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-secondary border-white/10">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteAccount.mutate(undefined)} className="bg-destructive hover:bg-destructive/90">
                      Delete Forever
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { supabase } from "@/integrations/supabase/client";

export async function uploadAvatar(
  userId: string,
  imageBlob: Blob
): Promise<string> {
  const fileName = `${userId}/avatar-${Date.now()}.jpg`;

  // Delete old avatars first
  const { data: existingFiles } = await supabase.storage
    .from("avatars")
    .list(userId);

  if (existingFiles && existingFiles.length > 0) {
    const filesToDelete = existingFiles.map((file) => `${userId}/${file.name}`);
    await supabase.storage.from("avatars").remove(filesToDelete);
  }

  const { data, error } = await supabase.storage
    .from("avatars")
    .upload(fileName, imageBlob, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(data.path);

  return publicUrl;
}

export async function deleteAvatar(userId: string): Promise<void> {
  const { data: existingFiles } = await supabase.storage
    .from("avatars")
    .list(userId);

  if (existingFiles && existingFiles.length > 0) {
    const filesToDelete = existingFiles.map((file) => `${userId}/${file.name}`);
    await supabase.storage.from("avatars").remove(filesToDelete);
  }
}

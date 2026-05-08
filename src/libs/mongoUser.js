import { getServerSession } from "next-auth";
import authOptions from "@/app/auth/options";
import { connectDB } from "@/libs/db";
import { User } from "@/models/User";

/**
 * Resolves the MongoDB user for the current session (JWT strategy).
 * Returns null when unauthenticated or user record is missing.
 */
export async function getMongoUserFromSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  await connectDB();
  const user = await User.findOne({ email: session.user.email }).select("_id email");
  return user;
}

import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { User } from "@/models/User";
import authOptions from "../../auth/options";


export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if(!session?.user?.email){
            return new Response("Unauthorized", { status: 401 });
        }

        mongoose.connect(process.env.MONGO_URL);

        const user = await User.findOne({ email: session.user.email }).select("name email payment cloudinaryPath image role linkedinConnected senderDomain linkupAccountId").lean();
        if (!user) {
            return new Response("User not found", { status: 404 });
        }

        return new Response(JSON.stringify({ ...user }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error(error);
        return new Response("Internal Server Error", { status: 500 });
    }
}
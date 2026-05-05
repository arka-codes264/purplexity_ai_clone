
import { createClient } from '@supabase/supabase-js'

// Create a single supabase client for interacting with your database
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!)

export default function Auth() {

    async function Login(provider: "github" | "google") {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: provider
        })

        if (error) {
            alert("Error signing in")
        }
        else {
            alert("Login successful")
        }
    }

    return (
        <div className="flex justify-center items-center h-screen">
            <button onClick={() => Login("github")}>GitHub Auth</button>
            {/* <button onClick={() => Login("google")}>Google Auth</button> */}
        </div>
    )
}
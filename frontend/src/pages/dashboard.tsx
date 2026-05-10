import { createClient } from "@/lib/client";
import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import axios from "axios"
import { BACKEND_URL } from "@/lib/config";

const supabase = createClient();


export default function Dashboard() {

    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        async function getUserInfo() {
            const { data, error } = await supabase.auth.getUser();
            if (error) console.error(error.message);
            if (data.user) {
                setUser(data.user);
            }
        }
        getUserInfo();
    }, []);

    useEffect(() => {
        async function getExistingConversations() {
            if (user) {
                const { data: { session } } = await supabase.auth.getSession()
                const jwt = session?.access_token;
                const response = await axios.get(`${BACKEND_URL}/conversations`, {
                    headers: {
                        Authorization: jwt
                    }
                })

                console.log(response.data);
            }
        }
        getExistingConversations();
    }, [user])


    return (
        <div>
            {!user && (
                <button onClick={() => navigate("/auth")}>
                    Sign in
                </button>
            )}
            {user && <div>
                {user?.email}
                <button onClick={() => {
                    supabase.auth.signOut();
                    setUser(null);
                }}>LogOut</button>

            </div>

            }
        </div>
    );
}
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AsesorasRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace("/dashboard/asesoras");
    }, [router]);
    return null;
}

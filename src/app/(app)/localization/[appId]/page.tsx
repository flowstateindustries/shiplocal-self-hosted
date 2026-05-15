"use client"

import { useParams } from "next/navigation"
import { ConfigForm } from "@/components/localization"

export default function LocalizationConfigPage() {
  const params = useParams()
  const appId = params.appId as string

  return <ConfigForm appId={appId} />
}

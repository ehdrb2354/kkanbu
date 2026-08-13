import { redirect } from "next/navigation";

// 소셜 로그인으로 통합되면서 가입/로그인이 같은 화면이 됐어요.
export default function SignupPage() {
  redirect("/login");
}

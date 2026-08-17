import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Loader2, Mail, ShieldCheck } from "lucide-react";
import { API_BASE_URL } from "@plane/constants";
import { AuthService } from "@/services/auth.service";

const authService = new AuthService();

type TCodeResponse = {
  existing: boolean;
  dev_code?: string;
};

export function WorkbenchLogin() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [existing, setExisting] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [csrfToken, setCsrfToken] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    authService
      .requestCSRFToken()
      .then((response) => setCsrfToken(response.csrf_token || ""))
      .catch(() => setError("登录服务暂时不可用，请稍后刷新页面"));

    if (new URLSearchParams(window.location.search).get("error_code")) {
      setError("验证码错误或已过期，请重新获取验证码");
    }
  }, []);

  const requestCode = async (event?: FormEvent) => {
    event?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = (await authService.generateUniqueCode({ email: email.trim().toLowerCase() })) as TCodeResponse;
      setEmail(email.trim().toLowerCase());
      setExisting(response.existing);
      setDevCode(response.dev_code || "");
      setCode(response.dev_code || "");
      setStep("code");
    } catch (requestError) {
      const errorCode = (requestError as { error_code?: string | number })?.error_code;
      setError(String(errorCode) === "5025" ? "邮件发送功能还没有配置" : "验证码发送失败，请检查邮箱后重试");
    } finally {
      setLoading(false);
    }
  };

  const resetEmail = () => {
    setStep("email");
    setCode("");
    setDevCode("");
    setError("");
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#f6f7f9] px-5 py-10 text-[#252f49]">
      <div className="w-full max-w-[420px] rounded-lg border border-[#e4e6ea] bg-white px-8 py-9 shadow-[0_10px_35px_rgba(37,47,73,0.08)]">
        <div className="mb-8 flex items-center gap-3">
          <div className="text-lg relative flex h-11 w-11 items-center justify-center rounded-lg bg-[#252f49] font-semibold text-white">
            产
            <span className="absolute right-2 bottom-2 h-2 w-2 rounded-full bg-[#ffc928]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">个人产品工作台</h1>
            <p className="text-sm mt-0.5 text-[#8a92a0]">登录你的工作台</p>
          </div>
        </div>

        {step === "email" ? (
          <form onSubmit={requestCode}>
            <label htmlFor="workbench-email" className="text-sm mb-2 block font-medium">
              邮箱
            </label>
            <div className="relative">
              <Mail className="absolute top-3 left-3 h-4 w-4 text-[#9aa1ad]" />
              <input
                id="workbench-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="请输入邮箱"
                autoComplete="email"
                autoFocus
                required
                className="text-sm h-10 w-full rounded-md border border-[#dfe2e7] bg-white pr-3 pl-10 outline-none placeholder:text-[#aeb4be] focus:border-[#e7b111] focus:ring-2 focus:ring-[#fff0ad]"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="text-sm mt-5 flex h-10 w-full items-center justify-center rounded-md bg-[#ffc928] font-medium hover:bg-[#f3bc14] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  获取验证码
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form method="POST" action={`${API_BASE_URL}/auth/${existing ? "magic-sign-in" : "magic-sign-up"}/`}>
            <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />
            <input type="hidden" name="email" value={email} />
            <button
              type="button"
              onClick={resetEmail}
              className="text-sm mb-5 flex items-center text-[#697283] hover:text-[#252f49]"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              {email}
            </button>
            <label htmlFor="workbench-code" className="text-sm mb-2 block font-medium">
              验证码
            </label>
            <div className="relative">
              <ShieldCheck className="absolute top-3 left-3 h-4 w-4 text-[#9aa1ad]" />
              <input
                id="workbench-code"
                name="code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                placeholder="请输入 6 位验证码"
                autoComplete="one-time-code"
                autoFocus
                required
                className="text-sm h-10 w-full rounded-md border border-[#dfe2e7] bg-white pr-3 pl-10 outline-none placeholder:text-[#aeb4be] focus:border-[#e7b111] focus:ring-2 focus:ring-[#fff0ad]"
              />
            </div>
            {devCode && (
              <p className="text-sm mt-3 rounded-md bg-[#fff7d6] px-3 py-2 text-[#735900]">
                本机测试验证码：<strong className="font-semibold">{devCode}</strong>
              </p>
            )}
            <button
              type="submit"
              disabled={!csrfToken || code.length !== 6}
              className="text-sm mt-5 flex h-10 w-full items-center justify-center rounded-md bg-[#ffc928] font-medium hover:bg-[#f3bc14] disabled:cursor-not-allowed disabled:opacity-50"
            >
              进入工作台
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void requestCode()}
              className="text-sm mt-3 h-9 w-full text-[#737b89] hover:text-[#252f49] disabled:opacity-50"
            >
              重新发送验证码
            </button>
          </form>
        )}

        {error && <p className="text-sm mt-4 text-[#c33b32]">{error}</p>}
      </div>
    </div>
  );
}

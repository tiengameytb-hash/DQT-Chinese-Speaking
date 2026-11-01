
const json = (status, data) => new Response(
  JSON.stringify(data),
  {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  }
);

export default async (request) => {
  if (request.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    // 1. Đọc cấu hình Netlify
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    if (!apiKey) {
      return json(503, {
        error: "Chưa đọc được GEMINI_API_KEY. Hãy kiểm tra Environment Variables và Functions scope trong Netlify."
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    // 2. Kiểm tra đăng nhập
    const token = (request.headers.get("authorization") || "")
      .replace(/^Bearer\s+/i, "");

    if (!token || !supabaseUrl || !supabaseKey) {
      return json(401, {
        error: "Bạn cần đăng nhập và cấu hình Supabase trước."
      });
    }

    const authCheck = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!authCheck.ok) {
      return json(401, {
        error: "Phiên đăng nhập hết hạn. Hãy đăng nhập lại."
      });
    }

    const user = await authCheck.json();

    const allowedEmail = (
      process.env.ALLOWED_EMAIL || "tiengameytb@gmail.com"
    ).toLowerCase();

    if ((user.email || "").toLowerCase() !== allowedEmail) {
      return json(403, {
        error: "Tài khoản chưa được cấp quyền."
      });
    }

    // 3. Đọc nội dung người học
    let body;

    try {
      body = await request.json();
    } catch {
      return json(400, {
        error: "Dữ liệu gửi lên không hợp lệ."
      });
    }

    const {
      mode,
      text,
      level = 1,
      topic = "",
      topicVi = "",
      question = "",
      grammar = [],
      history = []
    } = body;

    if (
      !["chat", "grade"].includes(mode) ||
      typeof text !== "string" ||
      !text.trim()
    ) {
      return json(400, {
        error: "Thiếu nội dung luyện tập."
      });
    }

    if (text.length > 12000) {
      return json(413, {
        error: "Nội dung quá dài, hãy chia thành đoạn ngắn."
      });
    }

    // 4. Xây dựng yêu cầu cho AI
    const hsk = Math.min(6, Math.max(1, Number(level) || 1));

    const system = `
Bạn là 小猫老师, gia sư tiếng Trung thân thiện.
Người học là người Việt đang học HSK ${hsk}.
Chủ đề: ${topic} (${topicVi}).
Câu hỏi luyện nói: ${question}.
Ngữ pháp gợi ý: ${JSON.stringify(grammar).slice(0, 3500)}.

Trả lời bằng tiếng Việt dễ hiểu.
Ví dụ tiếng Trung kèm pinyin khi hữu ích.
Điều chỉnh độ khó theo HSK.
Không bịa lỗi nếu câu đúng.
Luôn tập trung vào điều người học vừa viết hoặc nói.
`;

    const instruction = mode === "chat"
      ? `
Tiếp tục hội thoại tự nhiên.
Phản hồi đúng nội dung người học vừa nói hoặc hỏi.
Nếu họ đặt câu hỏi thì trả lời trực tiếp.
Sửa tối đa 1-2 lỗi quan trọng nếu có.
Giải thích ngắn bằng tiếng Việt.
Sau đó hỏi MỘT câu tiếp nối để họ luyện nói.
Khuyến khích trả lời bằng tiếng Trung.
Trả lời khoảng 2-5 câu.
`
      : `
Chấm bài nói trên thang điểm 100.
Đánh giá bám chủ đề, ngữ pháp, từ vựng,
cách diễn đạt, mạch lạc và triển khai ý phù hợp HSK ${hsk}.

Chỉ chỉ ra lỗi có bằng chứng.
Nếu câu đúng hãy nói rõ.
Đưa ra câu sửa tự nhiên hơn, cấu trúc thay thế
và bài mẫu có triển khai ý.

Đây là đánh giá văn bản, không chấm phát âm
hay thanh điệu.

Trả về JSON đúng cấu trúc:
{
  "score": 85,
  "feedback": "Nhận xét tiếng Việt",
  "corrections": ["Câu gốc → câu sửa và giải thích"],
  "alternatives": ["Cấu trúc thay thế kèm ví dụ"],
  "model_answer": "Bài mẫu tiếng Trung phù hợp HSK ${hsk}",
  "next_step": "Bài tập tiếp theo"
}
`;

    const conversation =
      mode === "chat" && Array.isArray(history)
        ? history.slice(-8).map(m =>
            `${m.role === "assistant" ? "小猫老师" : "Người học"}: ${String(m.content || "").slice(0, 1200)}`
          ).join("\n")
        : "";

    const prompt = mode === "chat"
      ? `${system}\n${conversation}\nNgười học vừa nói: ${text}\n${instruction}`
      : `${system}\nBài nói của người học:\n${text}\n${instruction}`;

    // 5. Gọi Gemini
    const generationConfig = {
      temperature: mode === "grade" ? 0.2 : 0.7,
      maxOutputTokens: mode === "grade" ? 1800 : 700
    };

    if (mode === "grade") {
      generationConfig.responseMimeType = "application/json";
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }]
            }
          ],
          generationConfig
        })
      }
    );

    const data = await geminiResponse.json().catch(() => ({}));

    if (!geminiResponse.ok) {
      return json(geminiResponse.status, {
        error: data.error?.message ||
          "Gemini đang bận hoặc đã hết hạn mức miễn phí."
      });
    }

    const output = (data.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || "")
      .join("\n")
      .trim();

    if (!output) {
      return json(502, {
        error: "Gemini chưa trả về nội dung. Có thể đã hết hạn mức."
      });
    }

    // 6. Trả kết quả trò chuyện
    if (mode === "chat") {
      return json(200, { text: output });
    }

    // 7. Trả kết quả chấm điểm
    try {
      const clean = output
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/, "")
        .trim();

      const result = JSON.parse(clean);

      if (
        typeof result.score !== "number" ||
        !Array.isArray(result.corrections) ||
        !Array.isArray(result.alternatives)
      ) {
        throw new Error("Invalid grading response");
      }

      result.score = Math.max(0, Math.min(100, result.score));

      return json(200, result);
    } catch {
      return json(502, {
        error: "Gemini trả kết quả chưa đúng định dạng. Vui lòng gửi lại bài."
      });
    }

  } catch (error) {
    return json(500, {
      error: "Lỗi xử lý AI: " + (error.message || "Unknown error")
    });
  }
};

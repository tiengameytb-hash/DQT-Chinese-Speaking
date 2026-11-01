const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body)
});

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  if (!apiKey) return json(503, { error: 'Chưa cấu hình GEMINI_API_KEY trong Netlify.' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return json(401, { error: 'Bạn cần đăng nhập và cấu hình Supabase trước.' });
  }
  const authCheck = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
  });
  if (!authCheck.ok) return json(401, { error: 'Phiên đăng nhập hết hạn. Hãy đăng nhập lại.' });
  const user = await authCheck.json();
  if ((user.email || '').toLowerCase() !== (process.env.ALLOWED_EMAIL || 'tiengameytb@gmail.com').toLowerCase()) {
    return json(403, { error: 'Tài khoản chưa được cấp quyền.' });
  }

  let body;
  try { body = JSON.parse(req.body || '{}'); } catch { return json(400, { error: 'Dữ liệu gửi lên không hợp lệ.' }); }
  const { mode, text, level = 1, topic = '', topicVi = '', question = '', grammar = [], history = [] } = body;
  if (!['chat', 'grade'].includes(mode) || typeof text !== 'string' || !text.trim()) return json(400, { error: 'Thiếu nội dung luyện tập.' });
  if (text.length > 12000) return json(413, { error: 'Nội dung quá dài, hãy chia thành đoạn ngắn.' });

  const hsk = Math.min(6, Math.max(1, Number(level) || 1));
  const system = `Bạn là 小猫老师, gia sư tiếng Trung thân thiện. Người học là người Việt, đang học HSK ${hsk}. Chủ đề: ${topic} (${topicVi}). Câu hỏi/chủ đề luyện nói: ${question}. Ngữ pháp gợi ý: ${JSON.stringify(grammar).slice(0, 3500)}. Trả lời bằng tiếng Việt dễ hiểu; ví dụ tiếng Trung kèm pinyin khi hữu ích. Điều chỉnh độ khó theo HSK. Không bịa lỗi nếu câu đúng. Luôn tập trung vào điều người học vừa viết/nói.`;
  const instruction = mode === 'chat'
    ? `Hãy tiếp tục hội thoại tự nhiên. Phản hồi đúng nội dung người học vừa nói hoặc hỏi; nếu họ đặt câu hỏi thì trả lời trực tiếp, không né tránh. Nhận xét/sửa tối đa 1-2 lỗi tiếng Trung quan trọng nếu có, giải thích ngắn bằng tiếng Việt, rồi hỏi MỘT câu tiếp nối liên quan để họ luyện nói. Khuyến khích trả lời bằng tiếng Trung. Trả lời khoảng 2-5 câu.`
    : `Chấm bài nói trên thang 100, đánh giá bám chủ đề, ngữ pháp, từ vựng, cách diễn đạt, độ mạch lạc và triển khai ý phù hợp HSK ${hsk}. Đây là đánh giá văn bản nhận diện/nhập vào, không chấm phát âm hay thanh điệu. Chỉ chỉ ra lỗi có bằng chứng; nếu câu đúng hãy nói rõ. Đưa ra câu sửa tự nhiên hơn, các cấu trúc thay thế và bài mẫu có triển khai ý. Trả về JSON đúng schema: {"score":number,"feedback":"nhận xét tiếng Việt","corrections":["câu gốc → câu sửa và giải thích"],"alternatives":["cấu trúc/cách diễn đạt thay thế kèm ví dụ"],"model_answer":"bài mẫu tiếng Trung phù hợp HSK ${hsk}, có triển khai ý","next_step":"bài tập tiếp theo"}.`;
  const conversation = mode === 'chat' && Array.isArray(history)
    ? history.slice(-8).map(m => `${m.role === 'assistant' ? '小猫老师' : 'Người học'}: ${String(m.content || '').slice(0, 1200)}`).join('\n')
    : '';
  const prompt = mode === 'chat'
    ? `${system}\n${conversation}\nNgười học vừa nói/hỏi: ${text}\n${instruction}`
    : `${system}\nBài nói của người học:\n${text}\n\n${instruction}`;

  const generationConfig = { temperature: mode === 'grade' ? 0.2 : 0.7, maxOutputTokens: mode === 'grade' ? 1800 : 700 };
  if (mode === 'grade') generationConfig.responseMimeType = 'application/json';
  let response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig })
    });
  } catch {
    return json(502, { error: 'Không kết nối được Gemini. Vui lòng thử lại.' });
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return json(response.status, { error: data.error?.message || 'Gemini đang bận hoặc đã hết hạn mức miễn phí.' });
  const output = (data.candidates?.[0]?.content?.parts || []).map(part => part.text || '').join('\n').trim();
  if (!output) return json(502, { error: 'Gemini chưa trả về nội dung. Có thể đã hết hạn mức; vui lòng thử lại sau.' });
  if (mode === 'chat') return json(200, { text: output });
  try {
    const clean = output.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    const result = JSON.parse(clean);
    return json(200, result);
  } catch {
    return json(502, { error: 'Gemini trả kết quả chưa đúng định dạng. Vui lòng gửi lại bài.' });
  }
};

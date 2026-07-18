const STORES = [["12", "신월점", "신동헌"], ["22", "신제주", "방명수"], ["25", "오라점", "박상기"], ["57", "제주점", "오한샘"], ["64", "고양시청", "길진오"], ["75", "역곡점", "김현우"], ["86", "송우점", "윤재영"], ["110", "개봉점", "이태영"], ["119", "양주시청점", "신동호"], ["122", "송추점", "김정민"], ["195", "마곡점", "임현수"], ["201", "영등포", "나민수"], ["212", "김포공항점", "이홍근"], ["219", "가양점", "김현호"], ["225", "종암점", "민세일"], ["235", "서의정부", "김완동"], ["244", "만가대", "최승현"], ["248", "양주덕정점", "정민혁"], ["272", "화전점", "신동헌"], ["274", "서강대교점", "이의성"], ["308", "목동점", "김도윤"], ["309", "일산점", "조민석"], ["326", "의정부IC점", "윤범채"], ["375", "파주점", "문희성"], ["377", "포천시청", "홍상수"], ["381", "포천점", "유현종"], ["391", "상봉점", "이의수"], ["401", "능곡점", "정은석"], ["414", "동두천점", "박중연"], ["422", "전곡점", "김민성"], ["447", "철원포천점", "이상민"], ["450", "서울장안점", "동현"], ["482", "문산파주점", "구대현"], ["489", "별내점", "김상준"], ["491", "별내700개점", "최준영"], ["512", "동서귀포", "김현구"], ["513", "서서귀포", "김정석"], ["530", "서강대교2점", "이의성"], ["559", "통일로점", "나준수"], ["560", "고양삼송점", "이환준"], ["562", "북고양점", "오준석"], ["569", "서일산점", "문수현"], ["579", "고양스타필드점", "조현식"], ["580", "탄현점", "이동호"], ["598", "진접점", "금동길"], ["606", "동의정부점", "이채현"], ["609", "내촌IC점", "장규상"], ["613", "서별내점", "조철민"], ["624", "태릉갈매점", "홍현수"], ["626", "일산덕이점", "지윤수"], ["632", "성산일출", "조광래"], ["633", "노형점", "김성준"], ["644", "고양성석점", "김동현"], ["645", "일산운정점", "이강일"], ["646", "파주금촌점", "나병철"], ["653", "진건점", "신남지"], ["706", "구파발점", "김민수"], ["657", "고양창릉점", "양희성"]].map(x => ({ no:x[0], name:x[1], owner:x[2] }));

function json(statusCode, body) {
  return { statusCode, headers: { "content-type":"application/json; charset=utf-8" }, body: JSON.stringify(body) };
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error:"POST만 지원합니다." });
  if (!process.env.OPENAI_API_KEY) return json(500, { error:"Netlify 환경변수 OPENAI_API_KEY가 설정되지 않았습니다." });

  let body;
  try { body = await req.json(); } catch { return json(400, { error:"요청 형식이 잘못되었습니다." }); }
  if (!body.image || !String(body.image).startsWith("data:image/")) return json(400, { error:"이미지가 없습니다." });
  if (String(body.image).length > 12_000_000) return json(413, { error:"이미지가 너무 큽니다." });

  const storeList = STORES.map(s => `${s.no} ${s.name} ${s.owner}`).join("\n");
  const instruction = `너는 타이어뱅크 점포 보고서 이미지 판별기다.
이미지에서 숫자나 실적 값은 검증하지 않는다. 오직 점포와 보고서 종류만 찾는다.

보고서 종류:
- eval: "1억벌기 일별 실행 평가서", 실행평가서
- goal: "최고수량과 1억벌기 목표와 달성", 목표와달성
- best: 최고달성 양식

반드시 아래 58개 점포 중 정확히 하나만 선택한다. 부분 문자열로 혼동하지 마라.
문산파주점과 파주점은 다르다.
서강대교점과 서강대교2점은 다르다.
일산점, 서일산점, 일산운정점, 일산덕이점은 모두 다르다.

점포 목록:
${storeList}

읽을 수 없거나 확신이 낮으면 store_no 또는 report_type을 null로 반환한다.
JSON만 반환한다.`;

  const schema = {
    type:"object",
    additionalProperties:false,
    properties:{
      store_no:{ anyOf:[{type:"string"},{type:"null"}] },
      store_name:{ anyOf:[{type:"string"},{type:"null"}] },
      report_type:{ anyOf:[{type:"string",enum:["eval","goal","best"]},{type:"null"}] },
      confidence:{ type:"number",minimum:0,maximum:1 },
      reason:{ type:"string" }
    },
    required:["store_no","store_name","report_type","confidence","reason"]
  };

  try {
    const apiRes = await fetch("https://api.openai.com/v1/responses", {
      method:"POST",
      headers:{ "authorization":`Bearer ${process.env.OPENAI_API_KEY}`, "content-type":"application/json" },
      body:JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
        input:[{
          role:"user",
          content:[
            { type:"input_text", text:instruction },
            { type:"input_image", image_url:body.image, detail:"high" }
          ]
        }],
        text:{ format:{ type:"json_schema", name:"report_result", strict:true, schema } },
        temperature:0
      })
    });
    const raw = await apiRes.json();
    if (!apiRes.ok) return json(apiRes.status, { error:raw?.error?.message || "OpenAI API 오류" });

    let outputText = raw.output_text;
    if (!outputText && Array.isArray(raw.output)) {
      outputText = raw.output.flatMap(o => o.content || []).find(c => c.type === "output_text")?.text;
    }
    if (!outputText) return json(502, { error:"분석 결과가 비어 있습니다." });
    const result = JSON.parse(outputText);

    const store = STORES.find(s => s.no === result.store_no);
    if (!store) { result.store_no=null; result.store_name=null; }
    else result.store_name=store.name;
    result.report_label = result.report_type === "eval" ? "실행평가서" : result.report_type === "goal" ? "목표와달성" : result.report_type === "best" ? "최고달성" : null;
    return json(200, result);
  } catch (e) {
    return json(500, { error:e?.message || "분석 중 오류가 발생했습니다." });
  }
};

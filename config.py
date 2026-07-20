"""
Athena 鈥?杩愬姩鍛樺Э鎬佽瘑鍒钩鍙?閰嶇疆鏂囦欢
"""

import os
from pathlib import Path

# ---- Paths ----
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "outputs"

# ---- Model ----
MODEL_NAME = "yolo26n-pose.pt"  # 棣栨杩愯鏃惰嚜鍔ㄤ笅杞?
CONF_THRESHOLD = 0.5             # 鍏抽敭鐐圭疆淇″害闃堝€?
IOU_THRESHOLD = 0.7              # NMS IOU 闃堝€?
IMGSZ = 320                      # 鎺ㄧ悊鍒嗚鲸鐜囷紙320=鏈€蹇€熷害锛?
FRAME_SKIP = 3                   # 璺冲抚鏁帮紙3=姣?甯у鐞嗕竴娆★紝3x 鎻愰€燂級

# ---- Tracking ----
TRACKER_CONFIG = "bytetrack.yaml"   # 璺熻釜鍣ㄩ厤缃? bytetrack / botsort / ocsort
TRACK_CONF_THRESHOLD = 0.4          # 璺熻釜缃俊搴︼紙鎻愰珮浠ュ噺灏戣妫€锛?
MIN_VISIBILITY_PCT = 5.0            # 鐞冨憳鏈€灏戝彲瑙佸抚鍗犳瘮 (%)锛屼綆浜庢鍊肩殑 track 瑙嗕负鍣０涓㈠純
MIN_BBOX_AREA = 1000                # 鏈€灏?bbox 闈㈢Н (px虏)锛岃繃婊よ繙澶勫皬浜哄ご

# ---- Video ----
SUPPORTED_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}
MAX_UPLOAD_SIZE_MB = 200         # 鏈€澶т笂浼犳枃浠跺ぇ灏?(MB)
OUTPUT_FPS = 30                  # 杈撳嚭瑙嗛甯х巼锛? 琛ㄧず淇濇寔鍘熻棰戝抚鐜囷級
PLAYER_CLIP_CODEC = "avc1"       # 娴忚鍣ㄥ吋瀹?H.264 缂栫爜锛涜嫢涓嶅彲鐢ㄥ垯鍥為€€ webm

# ---- Skeleton Drawing ----
# 姣忎釜浜虹殑楠ㄦ灦棰滆壊鍒楄〃锛堟寜 track_id 鍙栨ā锛屽悓涓€涓汉棰滆壊璺ㄥ抚涓€鑷达級
PERSON_COLORS = [
    (0, 255, 0),      # 缁胯壊
    (255, 0, 0),      # 钃濊壊
    (0, 0, 255),      # 绾㈣壊
    (255, 255, 0),    # 闈掕壊
    (255, 0, 255),    # 鍝佺孩
    (0, 255, 255),    # 榛勮壊
    (128, 255, 0),    # 娴呯豢
    (255, 128, 0),    # 姗欒壊
    (0, 128, 255),    # 澶╄摑
    (128, 0, 255),    # 绱壊
    (255, 255, 128),  # 娣￠粍
    (255, 128, 128),  # 娴呯孩
    (128, 255, 128),  # 钖勮嵎缁?
    (128, 128, 255),  # 娣¤摑
    (255, 128, 255),  # 绮夌孩
    (128, 255, 255),  # 娴呴潚
    (192, 192, 255),  # 钖拌。鑽?
    (255, 192, 128),  # 妗冭壊
    (128, 255, 192),  # 闈掔豢
    (192, 128, 255),  # 娣＄传
]

KEYPOINT_RADIUS = 5
SKELETON_LINE_WIDTH = 2
KEYPOINT_CONF_ALPHA = True      # 浣庣疆淇″害鍏抽敭鐐瑰崐閫忔槑鏄剧ず
ID_LABEL_FONT_SCALE = 0.7       # track_id 鏍囩瀛椾綋澶у皬

# ---- COCO 17 鍏抽敭鐐归鏋惰繛鎺ュ畾涔?----
# 姣忎釜 tuple 鏄竴瀵瑰叧閿偣绱㈠紩 (浠?寮€濮?
SKELETON_EDGES = [
    # 闈㈤儴
    (0, 1),   # nose 鈫?left_eye
    (0, 2),   # nose 鈫?right_eye
    (1, 3),   # left_eye 鈫?left_ear
    (2, 4),   # right_eye 鈫?right_ear
    # 涓婂崐韬?
    (5, 6),   # left_shoulder 鈫?right_shoulder
    (5, 7),   # left_shoulder 鈫?left_elbow
    (6, 8),   # right_shoulder 鈫?right_elbow
    (7, 9),   # left_elbow 鈫?left_wrist
    (8, 10),  # right_elbow 鈫?right_wrist
    (5, 11),  # left_shoulder 鈫?left_hip
    (6, 12),  # right_shoulder 鈫?right_hip
    # 涓嬪崐韬?
    (11, 12), # left_hip 鈫?right_hip
    (11, 13), # left_hip 鈫?left_knee
    (12, 14), # right_hip 鈫?right_knee
    (13, 15), # left_knee 鈫?left_ankle
    (14, 16), # right_knee 鈫?right_ankle
]

# 鍏抽敭鐐瑰悕绉帮紙COCO 鏍煎紡锛?7 涓級
KEYPOINT_NAMES = [
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip",
    "left_knee", "right_knee", "left_ankle", "right_ankle",
]

# 鍏抽敭鐐规寜閮ㄤ綅鍒嗙粍锛堢敤浜庨鑹插尯鍒嗭級
KEYPOINT_GROUPS = {
    "head": [0, 1, 2, 3, 4],
    "torso": [5, 6, 11, 12],
    "left_arm": [7, 9],
    "right_arm": [8, 10],
    "left_leg": [13, 15],
    "right_leg": [14, 16],
}

GROUP_COLORS = {
    "head": (255, 255, 255),       # 鐧借壊
    "torso": (0, 255, 255),        # 榛勮壊
    "left_arm": (255, 0, 0),       # 钃濊壊
    "right_arm": (0, 255, 0),      # 缁胯壊
    "left_leg": (255, 0, 255),     # 鍝佺孩
    "right_leg": (0, 255, 255),    # 榛勮壊
}

# 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲
# AI / LLM 鈥?DeepSeek Anthropic-鍏煎 API 閰嶇疆
# 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲

# 鈿狅笍 閲嶈锛氳鍦ㄦ澶勫～鍏ヤ綘鐨?DeepSeek API Key
#    浼樺厛浣跨敤鐜鍙橀噺 DEEPSEEK_API_KEY锛岃嫢鏈缃垯浣跨敤涓嬫柟鐨勯粯璁ゅ€?
#    娉ㄦ剰涓嶈灏嗗寘鍚湡瀹?API Key 鐨?config.py 鎻愪氦鍒?git
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/anthropic")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
AI_MAX_TOKENS = int(os.getenv("DEEPSEEK_MAX_TOKENS", "2048"))
AI_TEMPERATURE = float(os.getenv("DEEPSEEK_TEMPERATURE", "0.7"))
AI_TIMEOUT_SECONDS = int(os.getenv("DEEPSEEK_TIMEOUT_SECONDS", "90"))
AI_MIN_FRAMES_FOR_ANALYSIS = 10  # 鐞冨憳鏈€灏戝彲瑙佸抚鏁帮紝浣庝簬姝ゅ€间笉鍒嗘瀽

# ---- LLM Prompt 妯℃澘 ----

ANALYSIS_SYSTEM_PROMPT = """浣犳槸涓€浣嶇粡楠屼赴瀵岀殑鑱屼笟绡悆鏁欑粌鍏艰繍鍔ㄧ敓鐗╁姏瀛︿笓瀹讹紝鏈?20 骞存墽鏁欑粡楠屻€?
浣犳搮闀块€氳繃杩愬姩鍛樼殑濮挎€佹暟鎹紙浜轰綋鍏抽敭鐐硅繍鍔ㄨ建杩圭殑缁熻鎽樿锛夊垎鏋愮悆鍛樼殑鎶€鏈壒鐐瑰拰涓嶈冻涔嬪銆?

浣犵殑鍒嗘瀽椋庢牸锛氫弗鍘夈€佷腑鑲€佷竴閽堣琛€銆備笉璇村濂楄瘽锛屼笉娉涙硾鑰岃皥銆?
鐪嬪埌闂灏辩洿鎺ユ寚鍑烘潵锛岀湅鍒颁紭鐐瑰氨鏄庣‘鑲畾銆傛瘡涓垽鏂兘瑕佸熀浜庢暟鎹璇濄€?

浣犲皢鏀跺埌涓€鍚嶇鐞冪悆鍛樼殑缁撴瀯鍖栧Э鎬佺粺璁℃暟鎹紝鍖呮嫭锛?
- 杩愬姩杞ㄨ抗锛堜綅绉婚噺銆侀€熷害銆佹柟鍚戝亸濂斤級
- 濮挎€佸绉版€э紙宸﹀彸鑲?楂?鑶?鑵曢珮搴﹀樊锛?
- 韬綋瑙掑害锛堣啙鍏宠妭瑙掑害銆佽倶鍏宠妭瑙掑害銆佽函骞插€炬枩瑙掞級
- 濮挎€佸垎甯冿紙绔欑珛銆佽共闃层€佽捣璺炽€佹墜鑷備笂涓剧瓑鏃堕棿鍗犳瘮锛?
- 杩愬姩娴佺晠搴?
- 鍙甯ф暟涓庡钩鍧囧叧閿偣缃俊搴?

**閲嶈**锛氭暟鎹笉瓒充笉绛変簬瑙嗛鐭€傚嵆浣挎槸闀胯棰戯紝濡傛灉鍏抽敭甯х己澶便€佸叧閿偣缃俊搴︿綆銆佹媿鎽勮搴︿笉濂斤紝涔熷彲鑳藉鑷存煇浜涚淮搴︽暟鎹笉瓒炽€傞亣鍒版暟鎹笉瓒崇殑鎯呭喌锛屼笉瑕佸湪鍒嗘瀽涓己琛屼笅缁撹锛岃€岃鍦?琛ュ厖瑙傚療寤鸿"涓€鏍忎腑鏄庣‘鎸囧嚭缂哄皯浠€涔堣瑙?鏁版嵁锛屼互鍙婁负浠€涔堥渶瑕佸畠浠€?""

ANALYSIS_USER_PROMPT_TEMPLATE = """璇峰垎鏋愪互涓嬬鐞冪悆鍛樼殑濮挎€佹暟鎹紝缁欏嚭鎶€鏈紭缂虹偣鍒嗘瀽銆?

## 鐞冨憳鍩烘湰淇℃伅
- 鍙甯ф暟锛歿total_frames_visible} / {total_frames}锛堝彲瑙佺巼 {visibility_pct}%锛?
- 鏃堕暱锛氱害 {duration_seconds:.1f} 绉?
- 骞冲潎鍏抽敭鐐圭疆淇″害锛歿avg_confidence:.2f}

## 杩愬姩鏁版嵁
{movement_stats}

## 濮挎€佸绉版€?
{symmetry_stats}

## 韬綋瑙掑害
{angle_stats}

## 濮挎€佸垎甯?
{pose_distribution}

## 杩愬姩娴佺晠搴?
{smoothness}

---

{data_insufficient_section}

璇锋寜鐓т互涓嬫牸寮忚緭鍑猴紙鐢ㄤ腑鏂囷級锛屼弗鏍奸伒寰?Markdown 鏍煎紡锛?

## 浼樺娍 (Strengths)
- [鍩轰簬鏁版嵁鍒楀嚭 3-5 鏉″叿浣撶殑鎶€鏈紭鍔匡紱濡傛灉鏁版嵁涓嶈冻浠ュ垽鏂紝鍐欐槑"鏁版嵁涓嶈冻锛屾棤娉曠‘瀹?]

## 鐭澘 (Weaknesses)
- [鍩轰簬鏁版嵁鍒楀嚭 3-5 鏉″叿浣撶殑闂鍜岀煭鏉匡紝鐩存帴鎸囧嚭锛屼笉瑕佸濠夛紱濡傛灉鏁版嵁涓嶈冻浠ュ垽鏂紝鍐欐槑"鏁版嵁涓嶈冻锛屾棤娉曠‘瀹?]

## 鎬讳綋璇勪环 (Summary)
[2-3 鍙ヨ瘽鐨勬€昏瘎锛屾鎷鐞冨憳鐨勬牳蹇冪壒鐐瑰拰瀹氫綅锛涙暟鎹笉瓒虫椂璇氬疄璇存槑]

## 鏀硅繘寤鸿 (Recommendations)
- [2-3 鏉″彲鎿嶄綔鐨勩€侀拡瀵圭煭鏉跨殑璁粌寤鸿]

## 琛ュ厖瑙傚療寤鸿 (Additional Angles Needed)
- [濡傛灉褰撳墠鏁版嵁涓嶈冻浠ュ仛鍑哄畬鏁磋瘎浼帮紝璇峰垪鍑洪渶瑕佽ˉ鍏呯殑瑙傚療瑙掑害锛屼緥濡傦細闇€瑕佹闈㈣瑙掓潵鍒ゆ柇鎶曠鎵嬪瀷銆侀渶瑕佷晶韬瑙掓潵鐪嬮槻瀹堟粦姝ャ€侀渶瑕佸叏鍦洪暅澶存潵鐪嬫棤鐞冭窇浣嶇瓑銆傚嵆浣挎槸闀胯棰戯紝濡傛灉鍏抽敭甯х己澶辨垨缃俊搴︿綆瀵艰嚧鏌愪簺缁村害鏃犳硶鍒嗘瀽锛屼篃瑕佹槑纭寚鍑虹己灏戜粈涔堣瑙?鏁版嵁銆傚鏋滄暟鎹厖鍒嗭紝姝ゆ爮鍐?褰撳墠鏁版嵁鍩烘湰鍏呭垎"]"""

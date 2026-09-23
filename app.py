import streamlit as st
from datetime import datetime

st.set_page_config(page_title="Work Jarvis Mission Control", page_icon="🤖", layout="wide", initial_sidebar_state="collapsed")

st.markdown(r"""
<style>
:root{--cyan:#45e9ff;--green:#31f7a4;--amber:#ffbd59;--bg:#020914;--panel:rgba(5,22,39,.76)}
.stApp{background:radial-gradient(circle at 50% 18%,#083b59 0,#061827 24%,#020914 63%);color:#eefaff}
[data-testid="stHeader"]{background:transparent}.block-container{max-width:1500px;padding:1.2rem 2rem 2rem}
.title{border:2px solid var(--cyan);border-radius:8px;text-align:center;padding:14px;color:#79ecff;font-size:clamp(22px,3vw,42px);font-weight:700;letter-spacing:7px;box-shadow:0 0 18px #1cc9ff80,inset 0 0 18px #1cc9ff25}
.core-wrap{text-align:center;padding:24px 0 15px}.core{width:175px;height:175px;margin:auto;border-radius:50%;display:grid;place-items:center;color:white;font-size:32px;font-weight:800;border:5px double var(--cyan);background:radial-gradient(circle,#d9ffff 0 8%,#49e4ff 9% 15%,#08334e 16% 48%,#020914 49%);box-shadow:0 0 20px var(--cyan),0 0 70px #008cff88;animation:pulse 2.2s infinite}
@keyframes pulse{50%{transform:scale(1.04);box-shadow:0 0 35px var(--cyan),0 0 95px #008cffaa}}
.core-label{color:#79ecff;font-size:22px;letter-spacing:4px;margin-top:14px}.agent{background:linear-gradient(145deg,rgba(10,34,53,.92),rgba(2,12,24,.9));border:1px solid #38dfff;border-radius:18px;padding:20px;text-align:center;min-height:190px;box-shadow:0 0 18px #23cbff38}.avatar{width:78px;height:78px;border-radius:50%;margin:auto;display:grid;place-items:center;border:3px solid var(--cyan);font-size:25px;font-weight:800;box-shadow:0 0 18px var(--cyan)}.name{font-size:25px;font-weight:700;margin-top:12px}.role{color:#a8c7d8}.status{color:var(--green);font-size:13px;margin-top:12px}.connector{background:var(--panel);border:1px solid #2edfff;border-radius:10px;padding:14px 12px;box-shadow:inset 0 0 15px #25dfff18}.dot{color:var(--green)}.latency{float:right;color:#8ddfff}.panel{background:var(--panel);border:1px solid #2edfff;border-radius:14px;padding:18px;min-height:275px}.feed-item{border-left:3px solid var(--cyan);padding:8px 12px;margin:9px 0;background:#071a2a}.time{color:#6ddef2;font-size:12px}.voice{text-align:center;border:2px solid var(--cyan);border-radius:18px;padding:18px;background:#03b7ff10;box-shadow:0 0 24px #1cc9ff35}.footer{text-align:center;color:#6c91a7;font-size:12px;margin-top:22px}
div[data-testid="stMetric"]{background:var(--panel);border:1px solid #1f789b;border-radius:12px;padding:12px}div.stButton>button{width:100%;border:1px solid var(--cyan);color:white;background:#0a354c}
</style>
""", unsafe_allow_html=True)

if "paused" not in st.session_state: st.session_state.paused=False
if "activities" not in st.session_state:
    st.session_state.activities=[("09:01","Mike prepared an Outlook reply draft"),("09:04","Harry summarized a Teams conversation"),("09:08","Tom reviewed incident INC123456"),("09:12","Chris generated the daily KPI summary")]

h1,h2=st.columns([12,1])
with h1: st.markdown('<div class="title">WORK JARVIS MISSION CONTROL</div>',unsafe_allow_html=True)
with h2:
    if st.button("▶" if st.session_state.paused else "⏸",help="Pause or resume agents"):
        st.session_state.paused=not st.session_state.paused; st.rerun()

k1,k2,k3,k4=st.columns(4)
k1.metric("Emails processed","385","+24")
k2.metric("Teams messages","142","+16")
k3.metric("Tickets resolved","56","+7")
k4.metric("Reports generated","18","+3")

state="PAUSED" if st.session_state.paused else "ONLINE"
st.markdown(f'<div class="core-wrap"><div class="core">KD</div><div class="core-label">AI ORCHESTRATOR · {state}</div></div>',unsafe_allow_html=True)

agents=[("MI","Mike","Email Dispatcher"),("HA","Harry","Channel Responder"),("TO","Tom","Ticket Resolver"),("CH","Chris","Analytics Lead")]
cols=st.columns(4)
for col,(initials,name,role) in zip(cols,agents):
    col.markdown(f'<div class="agent"><div class="avatar">{initials}</div><div class="name">{name}</div><div class="role">{role}</div><div class="status">● {state}</div></div>',unsafe_allow_html=True)

st.markdown("### Enterprise systems")
connectors=[("Outlook","24 ms"),("Teams","18 ms"),("ServiceNow","2 ms"),("SharePoint","31 ms"),("Files","Connected")]
for col,(label,latency) in zip(st.columns(5),connectors):
    col.markdown(f'<div class="connector"><span class="dot">●</span> {label}<span class="latency">{latency}</span></div>',unsafe_allow_html=True)

st.markdown("<br>",unsafe_allow_html=True)
left,right=st.columns([2,1])
with left:
    items="".join(f'<div class="feed-item"><span class="time">{t}</span><br>{msg}</div>' for t,msg in st.session_state.activities)
    st.markdown(f'<div class="panel"><h3>Live activity feed</h3>{items}</div>',unsafe_allow_html=True)
with right:
    st.markdown('<div class="panel"><h3>Chief AI analysis</h3><b>Priority items detected</b><br><br>• 4 emails awaiting review<br>• 2 approvals pending<br>• 1 ServiceNow incident open<br><br><b style="color:#45e9ff">Recommendation</b><br>Review drafts before any external action.</div>',unsafe_allow_html=True)

st.markdown("<br>",unsafe_allow_html=True)
st.markdown('<div class="voice"><div style="font-size:40px">🎙️</div><h2>Command Center</h2><div>Type a request for Work Jarvis</div></div>',unsafe_allow_html=True)
command=st.chat_input("Example: Summarize today's emails")
if command:
    now=datetime.now().strftime("%H:%M")
    st.session_state.activities.insert(0,(now,f'KD received command: "{command}"'))
    st.success(f'Command queued safely: {command}')
    st.info("Demo mode is active. No email, Teams message, or ticket was changed.")

st.markdown(f'<div class="footer">Work Jarvis Enterprise Platform · {state} · {datetime.now().strftime("%d-%b-%Y %H:%M:%S")}</div>',unsafe_allow_html=True)

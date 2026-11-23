from __future__ import annotations

import json
import re
import uuid
from datetime import datetime

import streamlit as st


st.set_page_config(
    page_title="J.A.R.V.I.S. Task Assistant",
    page_icon="✦",
    layout="wide",
)

st.markdown(
    """
    <style>
      .stApp { background: radial-gradient(ellipse at 50% 0%, #102638 0%, #07111d 55%, #050a12 100%); }
      [data-testid="stSidebar"] { background: #08131f; border-right: 1px solid #173247; }
      .jarvis-subtitle { color: #9eb2c6; margin-top: -0.7rem; }
      .jarvis-note { color: #9eb2c6; font-size: 0.85rem; }
      div[data-testid="stChatMessage"] { border: 1px solid rgba(72, 191, 230, .12); border-radius: 14px; }
    </style>
    """,
    unsafe_allow_html=True,
)


TASK_PREFIX = re.compile(
    r"^(?:add task:?|new task:?|task:|todo:|remind me to|don't forget to|i need to|i have to)\s*",
    re.IGNORECASE,
)
TASK_VERBS = re.compile(
    r"^(?:prepare|write|call|buy|finish|complete|review|study|clean|plan|organize|pay|send|create|update|fix|check|book|meet|read|practice|submit|visit|pick up|take|build|design|draft|research|renew|cancel|water|do|make|work on|look into)\b",
    re.IGNORECASE,
)
TIME_PATTERN = re.compile(r"\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b|\b\d{1,2}:\d{2}\b", re.IGNORECASE)


def init_state() -> None:
    st.session_state.setdefault("jarvis_tasks", [])
    st.session_state.setdefault(
        "jarvis_messages",
        [
            {
                "role": "assistant",
                "content": (
                    "J.A.R.V.I.S. is ready. Type a task such as ‘prepare slides’ or "
                    "‘remind me to send the report at 5pm’."
                ),
            }
        ],
    )


def add_task(text: str) -> dict[str, object]:
    clean = TASK_PREFIX.sub("", text.strip())
    time_match = TIME_PATTERN.search(clean)
    due = time_match.group(0).upper() if time_match else ""
    title = TIME_PATTERN.sub("", clean).strip(" .,!—-")
    if not title:
        title = clean
    urgent = bool(re.search(r"\b(urgent|asap|important|immediately|high priority)\b", clean, re.I))
    category = "Work" if re.search(r"\b(report|meeting|email|code|project|client|work|review)\b", clean, re.I) else "Personal"
    task: dict[str, object] = {
        "id": uuid.uuid4().hex,
        "title": title[:1].upper() + title[1:],
        "due": due,
        "priority": "High" if urgent else "Normal",
        "category": category,
        "completed": False,
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
    }
    st.session_state.jarvis_tasks.insert(0, task)
    return task


def respond(text: str) -> str:
    lower = text.strip().lower()
    if re.fullmatch(r"(?:hi|hello|hey|hey jarvis|hello jarvis)[!. ]*", lower):
        pending = sum(not task["completed"] for task in st.session_state.jarvis_tasks)
        return f"Hello. You have {pending} open task(s). What would you like to add?"

    if re.search(r"\b(plan my day|daily briefing|what are my tasks|status report)\b", lower):
        pending = [task for task in st.session_state.jarvis_tasks if not task["completed"]]
        high = sum(task["priority"] == "High" for task in pending)
        return f"You have {len(pending)} open task(s), including {high} high-priority task(s)."

    if re.match(r"^(?:open|launch|start)\b", lower) or re.search(
        r"\b(system info|cpu|ram|battery|lock screen|lock laptop)\b", lower
    ):
        return (
            "This Streamlit version runs on a remote server, so it cannot open apps or read/control "
            "your Windows PC. You can still track that request as a task by starting with ‘Add task:’."
        )

    explicit = bool(TASK_PREFIX.match(text.strip()))
    direct = bool(TASK_VERBS.match(text.strip()))
    has_question = "?" in text or re.match(
        r"^(?:what|who|when|where|why|how|can you|could you|would you|do you|is|are)\b",
        lower,
    )
    if explicit or (direct and not has_question):
        task = add_task(text)
        due = f" (time: {task['due']})" if task["due"] else ""
        return f"Added to your task list: **{task['title']}**{due}."

    if has_question:
        return (
            "I can add and organize tasks in this Streamlit version. Try ‘prepare slides’, "
            "‘add task: review the report’, or ‘remind me to call Sam at 3pm’."
        )

    return "I didn’t recognize that as a task. Start with an action (like ‘write’, ‘call’, or ‘prepare’) or use ‘Add task: …’."


def handle_chat(text: str) -> None:
    st.session_state.jarvis_messages.append({"role": "user", "content": text})
    reply = respond(text)
    st.session_state.jarvis_messages.append({"role": "assistant", "content": reply})


init_state()

st.title("✦ J.A.R.V.I.S.")
st.markdown('<p class="jarvis-subtitle">Personal task assistant · Streamlit Cloud edition</p>', unsafe_allow_html=True)

with st.sidebar:
    st.subheader("Task queue")
    tasks = st.session_state.jarvis_tasks
    open_count = sum(not task["completed"] for task in tasks)
    st.metric("Open tasks", open_count)

    if not tasks:
        st.caption("No tasks yet. Add one in the chat.")

    remove_ids: list[str] = []
    for task in tasks:
        task_id = str(task["id"])
        task_title = str(task["title"])
        checked = st.checkbox(
            task_title,
            value=bool(task["completed"]),
            key="task_done_" + task_id,
        )
        task["completed"] = checked
        details = [str(task["priority"]), str(task["category"])]
        if task["due"]:
            details.append("at " + str(task["due"]))
        st.caption(" · ".join(details))
        if st.button("Remove", key="task_remove_" + task_id, width="stretch"):
            remove_ids.append(task_id)

    if remove_ids:
        st.session_state.jarvis_tasks = [
            task for task in st.session_state.jarvis_tasks if task["id"] not in remove_ids
        ]
        st.rerun()

    if tasks:
        st.download_button(
            "Download task list",
            data=json.dumps(tasks, indent=2),
            file_name="jarvis_tasks.json",
            mime="application/json",
            width="stretch",
        )

    st.divider()
    st.markdown(
        '<p class="jarvis-note">Tasks live in this browser session. This cloud app cannot control your Windows desktop.</p>',
        unsafe_allow_html=True,
    )

for message in st.session_state.jarvis_messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

prompt = st.chat_input("Type a task or ask about your task list…")
if prompt:
    handle_chat(prompt)
    st.rerun()

# J.A.R.V.I.S. Task Assistant

This repository includes a Streamlit Cloud version for typed chat and task tracking, plus the original React/Vite desktop companion project.

## Deploy the Streamlit version

No Python installation is needed on your computer. Streamlit Community Cloud installs the Python app and `requirements.txt` on its server.

1. Push this repository to GitHub.
2. Sign in to [Streamlit Community Cloud](https://share.streamlit.io/) with GitHub and choose **Create app**.
3. Select this repository, the `main` branch, and `streamlit_app.py` as the app file.
4. Deploy. The app offers typed task capture, task completion/removal, a task queue, and JSON export.

## Streamlit version limits

- Tasks and chat are held in the current Streamlit browser session. They are not backed up to a database and may be lost when the session ends or the app restarts.
- This hosted version cannot launch apps, read telemetry, or otherwise control your Windows PC. Its code runs on Streamlit's remote server.
- Due times are recorded as task labels; the app does not send notifications.
- The command handling is a small local parser, not a connected generative AI model.

## Run the original React/Vite version on Windows

The React version and Node.js local companion are still included. Extract the project, run `setup_windows.bat`, then `run_jarvis.bat`. The local companion can request Windows actions subject to the app's permissions. Python is not needed.

## Development

- Streamlit: `streamlit run streamlit_app.py`
- React: `npm install` then `npm run dev`
- React production build: `npm run build`

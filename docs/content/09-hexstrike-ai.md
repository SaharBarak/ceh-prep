# 09 — HexStrike-AI: AI-Powered MCP Cybersecurity Automation Platform

- **Source:** Instagram reel — https://www.instagram.com/reel/DXti35aCTby/
- **Author:** [@rgsecurityteam](https://instagram.com/rgsecurityteam)
- **Shared:** 2026-05-03
- **Duration:** 59s
- **GitHub repo:** **[0x4m4/hexstrike-ai](https://github.com/0x4m4/hexstrike-ai)** (MIT, also packaged in Kali as `hexstrike-ai`)
- **External links:** Kali Tools package page; YouTube install walkthrough (linked from repo README)

## Caption

HexStrike-AI: The Future of Ethical Hacking? 💻

`#cybersecurity #ethicalhacking #infosec #pentesting #ai #artificialintelligence #techtrends #securitytools #techtips #codinglife #softwaredevelopment #automation #hexstrikeai #cybersec #reelsviral #programming`

## Audio transcript

Music only — no spoken content.

## On-screen walkthrough (recovered via OCR + frame review)

The reel is a screen-recorded demo on Kali Linux against a deliberately vulnerable "We Like To Shop" lab. Visual evidence reconstructed from frames:

1. **Kali Tools package page** — `apt` distribution route:
   ```
   sudo apt install hexstrike-ai
   ```
   Description: *AI-Powered MCP Cybersecurity Automation Platform — HexStrike AI MCP v6.0, multi-agent architecture with autonomous agents, intelligent decision-making, and vulnerability intelligence.* Installed size: 2.75 MB.

2. **`hexstrike_mcp` CLI** (run as `root@kali`):
   ```
   usage: hexstrike_mcp.py [-h] [--server SERVER] [--timeout TIMEOUT] [--debug]
     --server SERVER    HexStrike AI API server URL (default: http://127.0.0.1:8888)
     --timeout TIMEOUT  Request timeout in seconds (default: 300)
     --debug            Enable debug logging
   ```

3. **GitHub repo** — `github.com/0x4m4/hexstrike-ai`, MIT license. README shows:
   ```
   # 3. Install Python dependencies
   pip3 install -r requirements.txt
   ```
   Supported AI clients: **5ire** (v0.14.0 not yet supported), **VS Code Copilot**, **Roo Code**, **Cursor**, **Claude Desktop**, or any MCP-compatible agent.

4. **Claude Desktop MCP wiring** — `~/.config/Claude/claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "hexstrike-ai": {
         "command": "python3",
         "args": ["--server", "http://localhost:8888"],
         "description": "HexStrike AI v6.0 - Advanced Cybersecurity Automation Platform",
         "timeout": 300,
         "disabled": false
       }
     }
   }
   ```

5. **Live demo target** — *We Like To Shop* (HTB-Academy-style web lab with "LAB · Not solved" badge). Browser tabs show *Exploit-DB* and *Google Hacking DB*. Terminal output references Oracle DB strings: `Oracle Database 11g Express Edition Release 11.2.0.2.0`, `PL/SQL Release 11.2.0.2.0`, `CORE 11.2.0.2.0`, `TNS 11.2.0.2.0`, `NLSRTL 11.2.0.2.0` — i.e. HexStrike fingerprinted the DB during the attack.

## Tools / keywords

MCP (Model Context Protocol) · Claude Desktop · Cursor · VS Code Copilot · multi-agent · autonomous pentesting · Kali · Oracle DB fingerprinting · Exploit-DB · Google Hacking DB

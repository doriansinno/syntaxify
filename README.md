# Syntaxify

> A tool to learn programming logic by thinking, not memorizing syntax.

Syntaxify is a web-based learning tool designed to help users understand programming logic without needing to know syntax.  
It translates natural language into executable code using AI and allows users to run code directly in the browser.

## Features
- Learn programming logic without writing syntax
- Convert natural language input into executable code using AI
- In-browser code execution using Pyodide and WebAssembly
- Task-based learning system with predefined exercises
- History feature to track previous inputs and results
- User authentication system with database integration

## How it Works
Users describe a task in natural language (e.g. “Create a loop from 1 to 5”).  
The system translates the input into code using AI and executes it directly in the browser.

## Tech Stack
- Java (backend)
- JavaScript / HTML / CSS (frontend)
- Pyodide & WebAssembly (browser execution)
- OpenAI API (AI-based code generation)

## Setup

To run this project locally, you need to start the backend server and provide an OpenAI API key.

### 1. Navigate to the server folder
cd "path/to/your/server"

### 2. Install dependencies
npm install

### 3. Set your API key

$env:OPENAI_API_KEY="your_api_key"

### 4. Start the server
npm start

## Requirements
- Node.js
- OpenAI API key

## Current Status

The core functionality of the application is working as intended.  
Users can generate and execute code, complete tasks, and view their history.

Some features are still being improved:
- Support for certain languages (e.g. C) is not yet fully implemented  
- Minor UI and formatting issues may occur  
- GDPR (DSGVO) compliance and an official imprint (Impressum) are not yet included  

This project is actively being developed and continuously improved.

## Purpose
The goal of this project is to make programming more accessible by focusing on logic instead of syntax, especially for beginners.

## Language
The application interface is in English.

## Security Note
The API key must be stored securely and should never be exposed in public repositories.

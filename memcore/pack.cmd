@echo off
rem pack.cmd — FACT STORE -> RID twin + lossless verify (memcore step 3: Pack)
rem usage: pack.cmd
rem output: fact_store.twin (portable, 9 views verified byte-identical)
setlocal
set MEMCORE=%~dp0
set STORE=I:\tools\pre_embedding_filter\fact_store.sqlite3

%MEMCORE%gguf_roundtrip.exe %STORE% %MEMCORE%fact_store.twin

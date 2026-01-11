#!/usr/bin/env python3
"""
SolidJS Documentation Fetcher

Fetches documentation from the official solidjs/solid-docs GitHub repository using gitingest.
Usage: python fetch_docs.py <topic>
Example: python fetch_docs.py "createResource"
         python fetch_docs.py "reactivity"
"""

import sys
import subprocess
import re
import os

def fetch_solidjs_docs(topic):
    """
    Fetch SolidJS documentation for a given topic using gitingest.

    Args:
        topic: The documentation topic to search for

    Returns:
        str: The documentation content
    """

    # Map common topics to specific file patterns
    topic_patterns = {
        'createSignal': 'create-signal',
        'createMemo': 'create-memo',
        'createEffect': 'create-effect',
        'createResource': 'create-resource',
        'createStore': 'stores.mdx',
        'Suspense': 'suspense.mdx',
        'Show': 'show.mdx',
        'For': 'for.mdx',
        'children': 'children.mdx',
        'splitProps': 'props.mdx',
        'batch': 'reactivity',
        'reactivity': 'intro-to-reactivity',
        'signals': 'signals.mdx',
        'effects': 'effects.mdx',
        'stores': 'stores.mdx',
        'context': 'context.mdx',
    }

    print(f"📚 Fetching SolidJS documentation for: {topic}")
    print(f"🔄 Using gitingest to fetch latest docs from solidjs/solid-docs...\n")

    # Use gitingest to fetch the docs
    cache_file = '/tmp/solidjs-docs.txt'

    # Check if we need to refresh the cache (or if it doesn't exist)
    needs_fetch = True
    if os.path.exists(cache_file):
        # Check if cache is less than 1 hour old
        cache_age = os.path.getmtime(cache_file)
        import time
        if time.time() - cache_age < 3600:
            needs_fetch = False
            print("✅ Using cached documentation (less than 1 hour old)\n")

    if needs_fetch:
        print("⬇️  Fetching fresh documentation...\n")
        try:
            subprocess.run([
                'gitingest',
                'https://github.com/solidjs/solid-docs',
                '-o', cache_file,
                '-i', '*.md',
                '-i', '*.mdx'
            ], check=True, capture_output=True, text=True)
            print("✅ Documentation fetched successfully\n")
        except subprocess.CalledProcessError as e:
            print(f"❌ Error fetching docs: {e}")
            print(f"stderr: {e.stderr}")
            return None

    # Read the ingested docs
    try:
        with open(cache_file, 'r', encoding='utf-8') as f:
            docs = f.read()
    except Exception as e:
        print(f"❌ Error reading cached docs: {e}")
        return None

    # Search for relevant sections
    pattern = topic_patterns.get(topic, topic.lower())

    # Find all file sections that match the pattern
    print(f"🔍 Searching for pattern: '{pattern}'\n")

    # Split by file markers
    file_sections = re.split(r'={40,}\nFILE: (.+?)\n={40,}', docs)

    matches = []
    for i in range(1, len(file_sections), 2):
        filename = file_sections[i]
        content = file_sections[i + 1] if i + 1 < len(file_sections) else ''

        # Check if this file is relevant
        if pattern in filename.lower() or pattern in content.lower():
            matches.append((filename, content))

    if not matches:
        print(f"❌ No documentation found for '{topic}'")
        print(f"\n💡 Try one of these topics:")
        print("  - createSignal, createMemo, createEffect, createResource")
        print("  - Suspense, Show, For, children")
        print("  - reactivity, signals, effects, stores, context")
        return None

    # Display results
    print(f"✅ Found {len(matches)} relevant file(s)\n")
    print("=" * 80)

    for filename, content in matches:
        print(f"\n📄 FILE: {filename}\n")
        print("=" * 80)

        # Truncate very long content
        if len(content) > 5000:
            print(content[:5000])
            print(f"\n... (truncated, {len(content) - 5000} more characters)")
        else:
            print(content)

        print("\n" + "=" * 80)

    return matches

def main():
    if len(sys.argv) < 2:
        print("Usage: python fetch_docs.py <topic>")
        print("\n📚 Example topics:")
        print("  - createSignal, createMemo, createEffect, createResource")
        print("  - Suspense, Show, For, children, splitProps")
        print("  - reactivity, signals, effects, stores, context")
        sys.exit(1)

    topic = sys.argv[1]
    fetch_solidjs_docs(topic)

if __name__ == '__main__':
    main()

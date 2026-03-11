# Configuration file for the Sphinx documentation builder.

project = 'CDL Scheduler'
copyright = '2026, ContextLab'
author = 'ContextLab'

extensions = [
    'myst_parser',
]

# MyST settings
myst_heading_anchors = 3

# Theme
html_theme = 'furo'
html_static_path = ['_static']
html_css_files = ['custom.css']

html_theme_options = {
    'light_css_variables': {
        'color-brand-primary': '#007030',
        'color-brand-content': '#007030',
    },
    'dark_css_variables': {
        'color-brand-primary': '#4CAF50',
        'color-brand-content': '#4CAF50',
    },
}

# Source settings
source_suffix = {
    '.rst': 'restructuredtext',
    '.md': 'markdown',
}

exclude_patterns = ['_build', 'Thumbs.db', '.DS_Store', 'google-account-setup.md', 'setup-guide.md']

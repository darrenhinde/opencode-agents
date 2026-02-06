#!/bin/bash
# Check if all agents are in appropriate profiles

set -e

echo "🔍 Checking profile coverage..."
echo ""

# Get all agent IDs
agents=$(jq -r '.components.agents[].id' registry.json)

errors=0

for agent in $agents; do
  # Get agent category
  category=$(jq -r ".components.agents[] | select(.id == \"$agent\") | .category" registry.json)
  
  # Check which profiles include this agent
  in_developer=$(jq -r ".profiles.developer.components[] | select(. == \"agent:$agent\")" registry.json 2>/dev/null || echo "")
  in_business=$(jq -r ".profiles.business.components[] | select(. == \"agent:$agent\")" registry.json 2>/dev/null || echo "")
  in_full=$(jq -r ".profiles.full.components[] | select(. == \"agent:$agent\")" registry.json 2>/dev/null || echo "")
  in_advanced=$(jq -r ".profiles.advanced.components[] | select(. == \"agent:$agent\")" registry.json 2>/dev/null || echo "")
  
  # Validate based on category
  case $category in
    "development")
      if [[ -z "$in_developer" ]]; then
        echo "❌ $agent (development) missing from developer profile"
        errors=$((errors + 1))
      fi
      if [[ -z "$in_full" ]]; then
        echo "❌ $agent (development) missing from full profile"
        errors=$((errors + 1))
      fi
      if [[ -z "$in_advanced" ]]; then
        echo "❌ $agent (development) missing from advanced profile"
        errors=$((errors + 1))
      fi
      ;;
    "content"|"data")
      if [[ -z "$in_business" ]]; then
        echo "❌ $agent ($category) missing from business profile"
        errors=$((errors + 1))
      fi
      if [[ -z "$in_full" ]]; then
        echo "❌ $agent ($category) missing from full profile"
        errors=$((errors + 1))
      fi
      if [[ -z "$in_advanced" ]]; then
        echo "❌ $agent ($category) missing from advanced profile"
        errors=$((errors + 1))
      fi
      ;;
    "meta")
      if [[ -z "$in_advanced" ]]; then
        echo "❌ $agent (meta) missing from advanced profile"
        errors=$((errors + 1))
      fi
      ;;
    "essential"|"standard")
      if [[ -z "$in_full" ]]; then
        echo "❌ $agent ($category) missing from full profile"
        errors=$((errors + 1))
      fi
      if [[ -z "$in_advanced" ]]; then
        echo "❌ $agent ($category) missing from advanced profile"
        errors=$((errors + 1))
      fi
      ;;
  esac
done

echo ""
if [[ $errors -eq 0 ]]; then
  echo "✅ Profile coverage check complete - no issues found"
  exit 0
else
  echo "❌ Profile coverage check found $errors issue(s)"
  exit 1
fi

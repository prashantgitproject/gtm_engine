'use client'

import {
  Box,
  Button,
  Checkbox,
  CheckboxGroup,
  FormHelperText,
  Input,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
  Stack,
  Text,
} from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { labelsForSelectedValues } from '@/constants/campaignSourcingOptions'

export function MultiOptionDropdown({
  popoverTitle = 'Choose options',
  helperText,
  options,
  value,
  onChange,
  placeholder = 'Select…',
  filterable = false,
  searchPlaceholder = 'Search…',
}) {
  const selected = Array.isArray(value) ? value : []
  const [query, setQuery] = useState('')
  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!filterable || !q) return options
    return options.filter((o) => {
      const hay = `${o.label ?? ''} ${o.value ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [options, query, filterable])

  const summary =
    selected.length === 0
      ? placeholder
      : labelsForSelectedValues(options, selected) || `${selected.length} selected`

  return (
    <Box>
      {helperText ? (
        <FormHelperText mb={2} fontSize="sm">
          {helperText}
        </FormHelperText>
      ) : null}
      <Popover
        placement="bottom-start"
        closeOnBlur
        onClose={() => {
          if (filterable) setQuery('')
        }}
      >
        <PopoverTrigger>
          <Button
            type="button"
            variant="outline"
            size="md"
            fontSize="md"
            fontWeight="normal"
            w="full"
            justifyContent="flex-start"
            textAlign="left"
            overflow="hidden"
            whiteSpace="normal"
            h="auto"
            minH="32px"
            py={2}
          >
            <Text noOfLines={3} flex="1" textAlign="left" fontSize="md">
              {summary}
            </Text>
          </Button>
        </PopoverTrigger>
        <PopoverContent maxW="sm" shadow="lg">
          <PopoverArrow />
          <PopoverCloseButton />
          <PopoverHeader fontSize="md" fontWeight="semibold">
            {popoverTitle}
          </PopoverHeader>
          <PopoverBody maxH={filterable ? '340px' : '260px'} overflowY="auto" py={2} fontSize="md">
            {filterable ? (
              <Input
                size="sm"
                mb={3}
                placeholder={searchPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            ) : null}
            <CheckboxGroup value={selected} onChange={onChange}>
              <Stack spacing={2}>
                {filteredOptions.map((o) => (
                  <Checkbox key={o.value} value={o.value} size="md">
                    {o.label}
                  </Checkbox>
                ))}
              </Stack>
            </CheckboxGroup>
          </PopoverBody>
        </PopoverContent>
      </Popover>
    </Box>
  )
}
